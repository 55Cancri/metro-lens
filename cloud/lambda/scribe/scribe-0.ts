/* scribe-0 is always the most recent version */
import * as aws from 'aws-sdk'
import * as lambda from 'aws-lambda'
import axios from 'axios'
import * as R from 'ramda'
import * as Rx from 'rxjs'
import * as Op from 'rxjs/operators'

/* import services */
import { apiServiceProvider } from '../services/api'
import { dynamoServiceProvider } from '../services/dynamodb'
import { dateServiceProvider } from '../services/date'

/* import utils */
import * as objectUtils from '../utils/objects'
import * as arrayUtils from '../utils/arrays'
import * as unicornUtils from '../utils/unicorns'
import { busMocks } from '../mocks/buses'

const { winston } = unicornUtils

/* import types */
import * as Dynamo from '../types/dynamodb'
import * as Api from '../types/api'

/* ensure the dynamo table is in the correct region */
aws.config.update({ region: 'us-east-1' })

/* initialize the environment variables */
const CONNECTOR_KEY = process.env.CONNECTOR_KEY || ''
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || ''
const MAX_DYNAMO_REQUESTS = 25

/* define error constants */
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`

/* setup dynamodb client */
const dynamodb = new aws.DynamoDB.DocumentClient()

/* define the handler */
export const handler = async (event?: lambda.APIGatewayEvent) => {
  winston.info('Starting.')

  /* initialize services */
  // !NOTE: do not instantiate these here.
  // !Do so in a wrapper for the lambda so they can be injected
  const dateService = dateServiceProvider()
  const apiService = apiServiceProvider({ httpClient: axios })
  const dynamoService = dynamoServiceProvider({ dynamodb, dateService })

  /* get the active buses current saved in dynamodb */
  const statusPromise = dynamoService.getStatusOfBuses()

  /* query for buses by route_id */
  const busesPromise = dynamoService.getBusPredictions()

  /* get the total number of api calls saved to dynamodb */
  const prevApiCountPromise = dynamoService.getApiCountTotal()

  /* wait for dynamo queries to finish */
  const [status, buses, prevApiCountTotal] = await Promise.all([
    statusPromise,
    busesPromise,
    prevApiCountPromise,
  ])

  /* extract the previous bus predictions: entity - "bus", id - "route_id"  */
  const { prevBusRoutes } = buses

  /* define the api params in case the api call needs to be made */
  const params = { key: CONNECTOR_KEY, format: 'json' } as const

  /* if no buses are active, it likely means db is empty, so call api again */
  const { statusOfBuses, routeApiCount } = !objectUtils.objectIsEmpty(
    status.statusOfBuses
  )
    ? status
    : await apiService.getActiveVehicles(params)

  /* convert the keys, which are vehicle ids, into an array */
  /* NOTE: active vehicles will become less and less overtime */
  /* the auditor will rehydrate it every 30 minutes, or how about a yang? */
  /* every 1 minute, active vehicles are called (errors set to false), and */
  /* every 15 minutes, false vehicles are api called. */
  const activeVehicleIds = Object.entries(statusOfBuses).reduce(
    (store, [key, bus]) => (bus.isActive ? [...store, key] : store),
    [] as string[]
  )

  /* batch the vehicles into arrays of 10 */
  const chunkedVehicleIds = arrayUtils.chunk(activeVehicleIds, 10)

  const vehiclesToBeUpdated = chunkedVehicleIds.map((listOfVehicleIds, i) => ({
    [`api set ${i}${1}`]: listOfVehicleIds.join(','),
  }))

  winston.info(
    `The following vehicles will be updated: ${JSON.stringify(
      vehiclesToBeUpdated
    )}`
  )

  /* create an array of the api parameter objects for the api calls */
  const batchedVehicleIds: Api.HttpClientConnectorParams[] = chunkedVehicleIds.map(
    (listOfVehicleIds) => ({
      key: CONNECTOR_KEY,
      format: 'json',
      vid: listOfVehicleIds.join(','),
    })
  )

  /* kick off a call for the vehicles */
  /* convert [ { vehicle: [ { vid: 2101 } ] }, ... ] -> [ { vid: 2101 }, ... ] */
  const vehiclesPromise = Promise.all(
    batchedVehicleIds.map(apiService.getVehicles)
  ).then((data) =>
    data.reduce((store, vehicle) => {
      if (vehicle.vehicle && vehicle.error) {
        return [...store, ...vehicle.vehicle, ...vehicle.error]
      }

      if (vehicle.vehicle) {
        return [...store, ...vehicle.vehicle]
      }

      return [...store, ...vehicle.error]
    }, [] as Api.ConnectorVehicleOrError[])
  )

  /* kick off a call for the predictions */
  /* convert [ { prd: [ { vid: 2101 } ] }, ... ] -> [ { vid: 2101 }, ... ] */
  const predictionsPromise = Promise.all(
    batchedVehicleIds.map(apiService.getPredictions)
  ).then((data) =>
    data.reduce((store, vehicle) => {
      if (vehicle.prd && vehicle.error) {
        return [...store, ...vehicle.prd, ...vehicle.error]
      }

      if (vehicle.prd) {
        return [...store, ...vehicle.prd]
      }

      return [...store, ...vehicle.error]
    }, [] as Api.ConnectorPredictionOrError[])
  )

  /* wait for the calls to finish */
  const [vehicles, predictions] = await Promise.all([
    await vehiclesPromise,
    await predictionsPromise,
  ])

  /* determine the number of api calls made */
  const vehicleApiCount = batchedVehicleIds.length
  const predictionsApiCount = batchedVehicleIds.length

  /* count the total number of api calls made */
  const apiCount = routeApiCount + vehicleApiCount + predictionsApiCount
  const apiCountTotal = Number(prevApiCountTotal) + apiCount

  winston.info(
    `Api Calls :: Routes: ${routeApiCount}. Vehicles: ${vehicleApiCount}. Predictions: ${predictionsApiCount}.`
  )

  /* any vehicles that returned an error from the vehicle api call will be set to false */
  const busStatusMap = vehicles.reduce(
    (store, vehicle) =>
      'msg' in vehicle
        ? {
            ...store,
            [vehicle.vid]: {
              isActive: false,
              wentOffline: new Date().toISOString(),
            },
          }
        : { ...store, [vehicle.vid]: { isActive: true, wentOffline: null } },
    statusOfBuses
  )

  const predictionsMap = predictions.reduce((store, prediction) => {
    if ('msg' in prediction) {
      winston.warn(`Bus ${prediction.vid} has gone offline.`)

      return store
    }

    const { rt, vid, stpid, stpnm, prdtm, prdctdn } = prediction

    const key = `${rt}_${vid}`

    const arrivalIn = /due/i.test(prdctdn) ? '0' : prdctdn

    const arrivalTime = dateService.parsePredictedTime(prdtm)

    const eta = { arrivalIn, arrivalTime, stopName: stpnm, stopId: stpid }

    if (store[key]) {
      return { ...store, [key]: [...store[key], eta] }
    }

    return { ...store, [key]: [eta] }
  }, {} as Record<string, unknown[]>)

  const lastUpdateTime = dateService.getNowInISO()

  const vehicleMap = vehicles.reduce((store, vehicle) => {
    if ('msg' in vehicle) {
      return store
    }

    const { rt, vid: vehicleId, lat, lon } = vehicle

    const key = `${rt}_${vehicleId}`

    const predictions = predictionsMap[key] as Dynamo.Prediction[]

    const data = { rt, lat, lon, vehicleId, predictions, lastUpdateTime }

    return { ...store, [key]: data }
  }, prevBusRoutes)

  /* log the size of the vehicle map */
  winston.info(
    `Vehicle Size: ${unicornUtils.formatBytes(objectUtils.sizeOf(vehicleMap))}.`
  )

  /* define a dynamodb item for the status of buses */
  const busStatusItem = dynamoService.generateItem({
    pk: 'bus',
    sk: 'status',
    status: busStatusMap,
  })

  /* define a dynamodb item to keep track of the historical status of buses */
  const busStatusHistoryItem = dynamoService.generateItem(
    {
      pk: 'bus_status_history',
      sk: dateService.getNowInISO(),
      status: busStatusMap,
      TTL: dateService.setTTLExpirationIn({ minutes: 2 }),
    },
    { historyTable: true }
  )

  /* define a dynamodb item for the bus predictions */
  const busPredictionsItem = dynamoService.generateItem({
    pk: 'bus',
    sk: 'predictions',
    routes: vehicleMap,
  })

  /* define a dynamodb item to keep track of the historical bus predictions */
  const busPredictionHistoryItem = dynamoService.generateItem(
    {
      pk: 'bus_predictions_history',
      sk: dateService.getNowInISO(),
      routes: vehicleMap,
      TTL: dateService.setTTLExpirationIn({ days: 1 }),
    },
    { historyTable: true }
  )

  /* define a dynamodb item for the number of api calls just made */
  const recentApiCountItem = dynamoService.generateItem(
    {
      pk: 'api_count_history',
      sk: dateService.getNowInISO(),
      calledBy: 'scribe',
      apiCount,
      TTL: dateService.setTTLExpirationIn({ years: 1 }),
    },
    { historyTable: true }
  )

  /* define a dynamodb item for the total number of api calls */
  const totalApiCountItem = dynamoService.generateItem({
    pk: 'api_count',
    sk: 'total',
    lastUpdatedBy: 'scribe',
    lastUpdated: dateService.getNowInISO(),
    apiCountTotal,
  })

  /* save items to dynamodb */
  await Promise.all([
    /* api counts */
    dynamoService.write(totalApiCountItem),
    dynamoService.write(recentApiCountItem, { historyTable: true }),

    /* bus status */
    dynamoService.write(busStatusItem),
    dynamoService.write(busStatusHistoryItem, { historyTable: true }),

    /* bus predictions */
    dynamoService.write(busPredictionsItem),
    dynamoService.write(busPredictionHistoryItem, { historyTable: true }),
  ])

  unicornUtils.print(vehicleMap)

  await apiService.busPositionMutation(GRAPHQL_ENDPOINT, vehicleMap)

  winston.info('Done.')
}
