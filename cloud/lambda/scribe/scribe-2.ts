import * as aws from "aws-sdk"
import * as lambda from "aws-lambda"
import axios from "axios"
import * as R from "ramda"
import * as Rx from "rxjs"
import * as Op from "rxjs/operators"

import { apiServiceProvider } from "../services/api-1"
import { dynamoServiceProvider } from "../services/dynamodb-1"
import { dateServiceProvider } from "../services/date"

import * as arrayUtils from "../utils/lists"
import { winston } from "../utils/unicorns"
import { busMocks } from "../mocks/buses"

import * as Dynamo from "../types/dynamodb"
import * as Api from "../types/api"

/* ensure the dynamo table is in the correct region */
aws.config.update({ region: "us-east-1" })

/* initialize the environment variables */
const TABLE_NAME = process.env.TABLE_NAME || ""
const PARTITION_KEY = process.env.PARTITION_KEY || ""
const SORT_KEY = process.env.SORT_KEY || ""
const CONNECTOR_KEY = process.env.CONNECTOR_KEY || ""
const MAX_DYNAMO_REQUESTS = 25

/* define error constants */
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`

/* setup dynamodb client */
const dynamodb = new aws.DynamoDB.DocumentClient()

/* define the handler */
export const handler = async (event?: lambda.APIGatewayEvent) => {
  winston.info("Start.")

  /* initialize services */
  // !NOTE: do not instantiate these here.
  // !Do so in a wrapper for the lambda so they can be injected
  const date = dateServiceProvider()
  const apiService = apiServiceProvider({ httpClient: axios })
  const dynamoService = dynamoServiceProvider({ dynamodb, date })

  /* get the total number of api calls saved to dynamodb */
  const prevApiCountTotal = await dynamoService.getApiCountTotal()
  // const prevApiCountResults = await dynamoService.getApiCountTotal()

  /* define the total number of api calls ever made */
  // const prevApiCountTotal =
  //   prevApiCountResults.length > 0 ? prevApiCountResults[0].apiCountTotal : 0

  winston.info({ prevApiCountTotal })

  /* get the metadata of active buses */
  const statusOfActiveBuses = await dynamoService.getStatusOfActiveBuses()

  /* query the db for vehicles with a status of active */
  const dataOfActiveBuses = await dynamoService.getVehiclesOfActiveBuses(
    statusOfActiveBuses
  )

  /* get the vehicleIds of the active buses */
  const vehicleIds = statusOfActiveBuses.map(R.prop("vehicleId"))

  // winston.info({ vehicleIds })

  /* create a map of active buses for constant time lookup */
  const statusMap = statusOfActiveBuses.reduce(
    (store, { vehicleId, ...rest }) => ({
      ...store,
      [vehicleId]: { ...rest, vehicleId },
    }),
    {} as Record<string, Dynamo.BusStatusItem>
  )

  /* create a map of active buses for constant time lookup */
  const vehicleMap = dataOfActiveBuses.reduce(
    (store, { vehicleId, ...rest }) => ({
      ...store,
      [vehicleId]: { ...rest, vehicleId },
    }),
    {} as Record<string, Dynamo.BusVehicleItem>
  )

  /* batch the vehicles into groups of 10 */
  const chunkedVehicleIds = arrayUtils.chunk(vehicleIds, 10)

  /* convert the arrays into strings */
  const batchedVehicleIds: Api.HttpClientConnectorParams[] = chunkedVehicleIds.map(
    (vehicleIdArray) => ({
      key: CONNECTOR_KEY,
      format: "json",
      vid: vehicleIdArray.join(","),
    })
  )

  /* make the parallel api calls. Should be array of merged bus information */
  const [busResults] = await Promise.all(
    batchedVehicleIds.map(apiService.makeDualApiCalls)
  )

  /* count the number of api calls made */
  const apiCount = batchedVehicleIds.length
  const apiCountTotal = Number(prevApiCountTotal) + apiCount

  /* define a timestamp */
  const timestamp = date.getNowInISO()

  /* define a type narrowing function */
  const isSuccessItem = (
    item: Api.ConnectorJoin | Api.ConnectorError
  ): item is Api.ConnectorJoin => {
    /* use a random property from the success response */
    if ("stpid" in item) return true
    return false
  }

  /* map an item to the format of a batch write request */
  const mapToRequest = <T>(Item: T) => ({
    PutRequest: { Item },
  })

  /* process and map a bus response to a dynamodb item */
  const mapToItem = (
    item: Api.ConnectorJoin | Api.ConnectorError
  ): Dynamo.BusVehicleItem | Dynamo.BusStatusItem => {
    // find the last recorded state of the bus saved to dynamodb
    const stateOfLastBus = vehicleMap[item.vid]
    const statusOfLastBus = statusMap[item.vid]

    // if the custom field from the merged api call is 'data' (and not 'errors'),
    if (isSuccessItem(item)) {
      // define the primary key of the vehicle item to be saved,
      const primaryKey = dynamoService.generateItem({
        pk: "bus",
        sk: `v0_${item.vid}_${item.stpid}`,
      })

      // then map the entire vehicle information to a dynamodb item
      return {
        ...stateOfLastBus,
        ...primaryKey,
        dateCreated: timestamp,
        stopId: item.stpid,
        stopName: item.stpnm,
        vehicleId: item.vid,
      }
    }

    // otherwise the bus returned an error so set to status to false
    return { ...statusOfLastBus, active: false, lastChecked: timestamp }
  }

  /* extract the merged bus data and the inactive buses */
  const { data, errors } = busResults

  // winston.info({ data, errors })

  /* map the active buses to dynamo items */
  const activeBuses = data.map(R.compose(mapToRequest, mapToItem))

  /* map the inactive buses to dynamo items */
  const inactiveBuses = errors.map(R.compose(mapToRequest, mapToItem))

  /* define a dynamo item for the number of api calls just made */
  const recentApiCountItem = dynamoService.generateItem({
    pk: "api_counter",
    sk: date.getNowInISO(),
    calledBy: "scribe",
    apiCount,
  })

  /* define a dynamo item for the total number of api calls */
  const totalApiCountItem = dynamoService.generateItem({
    pk: "api_counter",
    sk: "total",
    lastUpdatedBy: "scribe",
    lastUpdated: date.getNowInISO(),
    apiCountTotal,
  })

  winston.info({ recentApiCountItem, totalApiCountItem })

  /* chunk the dynamodb items into arrays of 25 items */
  const chunkedBusItems = arrayUtils.chunk(
    [
      ...activeBuses,
      ...inactiveBuses,
      mapToRequest(recentApiCountItem),
      mapToRequest(totalApiCountItem),
    ] as Dynamo.WriteRequest[],
    25
  )

  // winston.info({ chunkedBusItems })

  const updateBusesAndApiCount = await Promise.all(
    chunkedBusItems.map(dynamoService.batchWrite)
  )

  winston.info("Done.")

  /* wmata buses */
  // const wmata = await axios.get(
  //   'https://api.wmata.com/NextBusService.svc/json/jPredictions',
  //   {
  //     headers: { api_key: process.env.WMATA_KEY },
  //     params: { StopID: '5001306' },
  //   }
  // )

  // console.log(wmata.data)
  // console.log(connector.data)
}
