import * as aws from 'aws-sdk'
import * as lambda from 'aws-lambda'
import axios from 'axios'
import * as R from 'ramda'
import * as Rx from 'rxjs'
import * as Op from 'rxjs/operators'

import { apiServiceProvider } from '../services/api'
import { dynamoServiceProvider } from '../services/dynamodb'
import { dateServiceProvider } from '../services/date'

import * as arrayUtils from '../utils/arrays'
import { winston, print, is } from '../utils/unicorns'
import { busMocks } from '../mocks/buses'

import * as Dynamo from '../types/dynamodb'
import * as Api from '../types/api'

aws.config.update({ region: 'us-east-1' })

winston.info(
  `localstack_hostname: ${process.env.LOCALSTACK_HOSTNAME}. aws_sam_local: ${process.env.AWS_SAM_LOCAL}`
)

/* environment variables */
const TABLE_NAME = process.env.TABLE_NAME || ''
const PRIMARY_KEY = process.env.PRIMARY_KEY || ''
const SORT_KEY = process.env.SORT_KEY || ''
const CONNECTOR_KEY = process.env.CONNECTOR_KEY || ''
const MAX_DYNAMO_REQUESTS = 25

/* define error constants */
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`

/* setup dynamodb client */
const dynamodb = new aws.DynamoDB.DocumentClient()
// const dynamodb = new aws.DynamoDB.DocumentClient({
//   apiVersion: 'latest',
//   region: 'us-east-1',
//   // @ts-ignore
//   // endpoint:
//   //   (process.env.AWS_SAM_LOCAL &&
//   //     new aws.Endpoint('http://host.docker.internal')) ||
//   //   undefined,
// })

export const handler = async (event?: lambda.APIGatewayEvent) => {
  winston.info('Start.')

  winston.info('Running invoke with: ', TABLE_NAME)

  // define the params object
  const Params = { TableName: 'metro' }

  // scan for the table, filtering on a doc type of initial or district invoice
  const results = await dynamodb.scan(Params).promise()

  console.log(results.Items?.[0])

  /* initialize services */
  // !NOTE: do not instantiate these here. Do so in a wrapper for the lambda so they can be injected
  const dateService = dateServiceProvider()
  const apiService = apiServiceProvider({ httpClient: axios })
  const dynamoService = dynamoServiceProvider({ dynamodb, dateService })

  /* get the total number of api calls ever made */
  const [
    { apiCountTotal: prevApiCountTotal = 0 },
  ] = await dynamoService.getApiCountTotal()

  /* get the metadata of active buses */
  const statusOfActiveBuses = await dynamoService.getStatusOfActiveBuses()

  /* query the db for vehicles with a status of active */
  const dataOfActiveBuses = await dynamoService.getVehiclesOfActiveBuses(
    statusOfActiveBuses
  )

  winston.info({ prevApiCountTotal, buses: dataOfActiveBuses })

  /* get the vehicleIds of the active buses */
  const vehicleIds = dataOfActiveBuses.map((bus) => bus.vehicleId)

  /* create a map of active buses for constant time lookup */
  const statusMap = statusOfActiveBuses.reduce(
    (store, { vehicleId, ...rest }) => ({
      ...store,
      [vehicleId]: { ...rest, vehicleId },
    }),
    {} as { [k: string]: Dynamo.BusStatusItem }
  )

  /* create a map of active buses for constant time lookup */
  const vehicleMap = dataOfActiveBuses.reduce(
    (store, { vehicleId, ...rest }) => ({
      ...store,
      [vehicleId]: { ...rest, vehicleId },
    }),
    {} as { [k: string]: Dynamo.BusVehicleItem }
  )

  /* batch the vehicles into groups of 10 */
  const chunkedVehicleIds = arrayUtils.chunk(vehicleIds, 10)

  /* convert the arrays into strings */
  const batchedVehicleIds: Api.HttpClientConnectorParams[] = chunkedVehicleIds.map(
    (vehicleIdArray) => ({
      key: CONNECTOR_KEY,
      format: 'json',
      vid: vehicleIdArray.join(','),
    })
  )

  /* make an api call and extract the bustime-response */
  // const makeDualApiCalls = async (options: Api.HttpClientOptions) => {
  //   const { data } = (await axios.get(options.url, {
  //     headers: { 'Content-Type': 'application/json' },
  //     params: options.params,
  //   })) as Api.ConnectorApiBase

  //   return data['bustime-response']
  // }

  /* make the parallel api calls. Should be array of merged bus information */
  const [busResults] = await Promise.all(
    batchedVehicleIds.map(apiService.makeDualApiCalls)
  )

  /* count the number of api calls made */
  const apiCount = batchedVehicleIds.length
  const apiCountTotal = Number(prevApiCountTotal) + apiCount

  /* define a timestamp */
  const timestamp = dateService.getNowInISO()

  /* define a type narrowing function */
  const isSuccessItem = (
    item: Api.ConnectorJoin | Api.ConnectorError
  ): item is Api.ConnectorJoin => {
    if ('stpid' in item) return true
    return false
  }

  /* map an item to the format of a batch write request */
  const mapToRequest = (
    Item: Dynamo.BusVehicleItem | Dynamo.BusStatusItem
  ) => ({
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
        pk: 'bus',
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

    // otherwise return date created? huh?
    // return { dateCreated: timestamp }
    // return { ...bus, active: false, dateCreated: timestamp }

    // bus from api response returned false. Set to inactive
    // return { ...stateOfLastBus, active: false, dateCreated: timestamp }
    return { ...statusOfLastBus, active: false, lastChecked: timestamp }
  }

  const { data, errors } = busResults

  const activeBuses = data.map(R.compose(mapToRequest, mapToItem))
  const inactiveBuses = errors.map(R.compose(mapToRequest, mapToItem))

  /* convert bus responses to dynamodb items */
  // const updatedBusItems = busResults.reduce((store, response) => {
  //   /* extract the pdr and err from the response  */
  //   // !prd and error no longer exist
  //   const { prd, error } = response

  //   /* map the active buses to dynamodb items */
  //   // !response.prd is now just response
  //   const activeBuses =
  //     'prd' in response
  //       ? response.prd!.map(R.compose(mapToRequest, mapToItem))
  //       : []

  //   /* map the inactive buses to dynamodb items */
  //   // !response.error is now just response
  //   const inactiveBuses =
  //     'error' in response
  //       ? response.error!.map(R.compose(mapToRequest, mapToItem))
  //       : []

  //   /* return the concatenated arrays  */
  //   return [...store, ...activeBuses, ...inactiveBuses]
  // }, [] as Dynamo.PutRequest[])

  const apiCountItem = dynamoService.generateItem({
    pk: 'api_counter',
    sk: dateService.getNowInISO(),
    apiCount,
  })
  const apiCountTotalItem = dynamoService.generateItem({
    pk: 'api_counter',
    sk: 'total',
    apiCountTotal,
  })

  /* chunk the dynamodb items into arrays of 25 items */
  const chunkedBusItems = arrayUtils.chunk(
    [
      ...activeBuses,
      ...inactiveBuses,
      // ...updatedBusItems,
      apiCountItem,
      apiCountTotalItem,
    ] as Dynamo.WriteRequest[],
    25
  )

  // winston.info(chunkedBusItems)
  winston.info({ apiCountTotal })

  const updateBusesAndApiCount = await Promise.all(
    chunkedBusItems.map(dynamoService.batchWrite)
  )

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
