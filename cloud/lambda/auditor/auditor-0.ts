/* auditor-0 is always the most recent version */
import * as aws from 'aws-sdk'
import * as lambda from 'aws-lambda'
import axios from 'axios'
import { promises as fs } from 'fs'

/* import services */
import { apiServiceProvider } from '../services/api'
import { dynamoServiceProvider } from '../services/dynamodb'
import { dateServiceProvider } from '../services/date'

/* import utils */
import * as objectUtils from '../utils/objects'
import * as arrayUtils from '../utils/arrays'
import * as UnicornUtils from '../utils/unicorns'

const { winston } = UnicornUtils

/* import types */
import * as Dynamo from '../types/dynamodb'
import * as Api from '../types/api'

/* ensure the dynamo table is in the correct region */
aws.config.update({ region: 'us-east-1' })

/* initialize the environment variables */
const CONNECTOR_KEY = process.env.CONNECTOR_KEY || ''
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

  /* define helper functions */
  const getStops = async (noStops: boolean) => {
    const params = { key: CONNECTOR_KEY, format: 'json' } as const

    /* if no stops were found in dynamodb, */
    if (noStops) {
      /* then query the api for every stop */
      return apiService.getEveryStop(params)
    }

    /* otherwise return no stops. This should prevent any items from being created */
    return { stops: [], stopApiCount: 0 }
  }

  const getMap = async (noMap: boolean) => {
    const params = { key: CONNECTOR_KEY, format: 'json' } as const

    /* if no map was found in dynamodb, */
    if (noMap) {
      /* then query the api for the map of every route */
      return apiService.getEveryMap(params)
    }

    /* otherwise return no map. This should prevent any items from being created */
    return { patterns: [], mapApiCount: 0 }
  }

  /* -------------------------------------------------------------------------- */
  /*                             Make DynamoDb calls                            */
  /* -------------------------------------------------------------------------- */

  /* get the status of the buses saved to dynamodb */
  const statusPromise = dynamoService.getStatusOfBuses()

  /* get the stops saved to dynamodb */
  const stopPromise = dynamoService.getStops()

  /* get the map saved to dynamodb */
  const mapPromise = dynamoService.getMaps()

  /* get the total number of api calls saved to dynamodb */
  const prevApiCountPromise = dynamoService.getApiCountTotal()

  /* extract the status, stops, map, and api count */
  const [dbStatus, dbStops, dbMap, prevApiCountTotal] = await Promise.all([
    statusPromise,
    stopPromise,
    mapPromise,
    prevApiCountPromise,
  ])

  /* -------------------------------------------------------------------------- */
  /*                          Update the inactive buses                         */
  /* -------------------------------------------------------------------------- */

  /* get the status of every bus */
  const { routeApiCount, statusOfBuses } = dbStatus

  /* determine the vids of the inactive buses */
  const inactiveVehicleIds = Object.entries(statusOfBuses).reduce(
    (store, [key, bus]) =>
      !bus.isActive && dateService.greaterThanMinsAgo(bus.wentOffline, 10)
        ? [...store, key]
        : store,
    [] as string[]
  )

  /* batch the inactive vehicles into arrays of 10 */
  const chunkedVehicleIds = arrayUtils.chunk(inactiveVehicleIds, 10)

  /* create an array of the api parameter objects for the api calls */
  const batchedVehicleIds: Api.HttpClientConnectorParams[] = chunkedVehicleIds.map(
    (listOfVehicleIds) => ({
      key: CONNECTOR_KEY,
      format: 'json',
      vid: listOfVehicleIds.join(','),
    })
  )

  /* query all the vehicles that have become deactivated */
  const vehicles = await Promise.all(
    batchedVehicleIds.map(apiService.getVehicles)
  )

  /* find the vehicles that are back online */
  const reactivatedVehicles = vehicles.reduce((store, vehicle) => {
    /* if a successful response returned for vehicles that were set to false, */
    if (vehicle.vehicle) {
      /* add those vid of those vehicles to the store so they can be updated in dynamodb */
      const vids = vehicle.vehicle.map(({ vid }) => vid)
      winston.info(`The following buses are back online: ${vids.join(', ')}.`)

      return [...store, ...vids]
    }

    return store
  }, [] as string[])

  /* update the dynamodb vehicle status object to update reactivated buses */
  const updatedVehicleStatusMap = reactivatedVehicles.reduce(
    (store, vid) => ({
      ...store,
      [vid]: { isActive: true, wentOffline: null },
    }),
    statusOfBuses
  )

  /* -------------------------------------------------------------------------- */
  /*                   Get stop data, possibly from api calls                   */
  /* -------------------------------------------------------------------------- */

  /* determine if there no stops currently saved to dynamodb */
  const noStops = objectUtils.objectIsEmpty(dbStops.stops)

  /* get the stops either saved to the db or make the api call */
  const { stops, stopApiCount } = await getStops(noStops)

  winston.info({ stopsLength: stops.length, stopApiCount })

  const stopsGroupedByRoute = stops.reduce((store, stop) => {
    /* check if this route exists in the store */
    const routeData = store[stop.routeId]

    /* if the route was  */
    if (routeData) {
      /* check if this stop exists in the route */
      const stopData = routeData[stop.stopId]

      if (!stopData) {
        /* add the stop to the route object */
        return {
          ...store,
          [stop.routeId]: { ...routeData, [stop.stopId]: stop },
        }
      }

      /* log error as two stops with the same stop id should not exist for a route */
      winston.info(
        `Found duplicate data for stopId ${stop.stopId} in route ${stop.routeId}. Skipping.`
      )

      return store
    }

    /* otherwise, create the route, and add the first stop to it */
    return { ...store, [stop.routeId]: { [stop.stopId]: stop } }
  }, {} as Record<string, any>)

  /* -------------------------------------------------------------------------- */
  /*                    Get map data, possibly from api calls                   */
  /* -------------------------------------------------------------------------- */

  /* determine if there no stops currently saved to dynamodb */
  const noMap = dbMap.map.length === 0

  /* if no map was found in dynamodb, make the api call */
  const { patterns, mapApiCount } = await getMap(noMap)

  /* -------------------------------------------------------------------------- */
  /*                   Determine the number of api calls made                   */
  /* -------------------------------------------------------------------------- */

  /* extract the number of api calls made during the dynamodb calls */
  const { dbStopsApiCount } = dbStops
  const { dbMapApiCount } = dbMap

  /* determine the number of api calls made */
  const vehicleApiCount = batchedVehicleIds.length

  /* count the total number of api calls made */
  const apiCount =
    dbStopsApiCount +
    dbMapApiCount +
    mapApiCount +
    stopApiCount +
    routeApiCount +
    vehicleApiCount
  const apiCountTotal = Number(prevApiCountTotal) + apiCount

  winston.info(
    `Api Calls :: Maps: ${mapApiCount}. Stops: ${stopApiCount}. Vehicles: ${vehicleApiCount}.`
  )
  winston.info(`Combined: ${apiCount}. Total: ${apiCountTotal}.`)

  /* -------------------------------------------------------------------------- */
  /*                 Create DynamoDb items of the acquired data                 */
  /* -------------------------------------------------------------------------- */

  /* create the items of stops grouped by route id */
  const stopItems = Object.entries(stopsGroupedByRoute).reduce(
    (store, [routeId, stops]) => [
      ...store,
      dynamoService.generateItem({
        pk: 'stop',
        sk: `route_id_${routeId}`,
        dateCreated: dateService.getNowInISO(),
        stops,
      }),
    ],
    [] as Record<string, unknown>[]
  )

  /* create the items for the maps */
  const mapItems = patterns.map(({ key, map }) =>
    dynamoService.generateItem({
      pk: 'route',
      sk: key,
      dateCreated: dateService.getNowInISO(),
      map,
    })
  )

  const stopSet = stops.reduce(
    (store, stop) => {
      const hasStop = store.some(
        (item) => item.stopId === stop.stopId && item.stopName === stop.stopName
      )

      if (hasStop) {
        return store
      }

      return [...store, stop]
    },
    [] as {
      routeId: string
      stopName: string
      stopId: string
      lat: number
      lon: number
    }[]
  )

  /* define a dynamo item that includes an array of all the stops */
  const stopSearchItem = dynamoService.generateItem({
    pk: 'stop',
    sk: 'search',
    dateCreated: dateService.getNowInISO(),
    stops: stopSet,
  })

  /* define a dynamo item for the buses that have come back online */
  const updatedActiveVehiclesItem = dynamoService.generateItem({
    pk: 'bus',
    sk: 'status',
    status: updatedVehicleStatusMap,
  })

  /* define a dynamo item for the number of api calls just made */
  const recentApiCountItem = dynamoService.generateItem(
    {
      pk: 'api_count_history',
      sk: dateService.getNowInISO(),
      calledBy: 'auditor',
      apiCount,
    },
    { historyTable: true }
  )

  /* define a dynamo item for the total number of api calls */
  const totalApiCountItem = dynamoService.generateItem({
    pk: 'api_count',
    sk: 'total',
    lastUpdatedBy: 'auditor',
    lastUpdated: dateService.getNowInISO(),
    apiCountTotal,
  })

  /* -------------------------------------------------------------------------- */
  /*                           Save items to DynamoDb                           */
  /* -------------------------------------------------------------------------- */

  try {
    /* kick off the single writes to dynamodb for bus predictions and api count */
    const singleWrites = Promise.all([
      /* total api count */
      dynamoService.write(totalApiCountItem),
      /* recent api count */
      dynamoService.write(recentApiCountItem, { historyTable: true }),
      /* map of online bus predictions */
      dynamoService.write(updatedActiveVehiclesItem),
    ])

    /* the only single upload that needs to be conditional or it will overwrite */
    /* array of 4000+ stops */
    const searchStopWrite =
      stopSet.length > 0 && dynamoService.write(stopSearchItem)

    /* batch write the stops grouped by route id */
    const batchStopWrites = arrayUtils
      .chunk(stopItems.map(dynamoService.toPutRequest), MAX_DYNAMO_REQUESTS)
      .reduce(async (store, items, i) => {
        await store

        return dynamoService.batchWrite(items)
      }, Promise.resolve([]) as Promise<Dynamo.BatchWriteOutput>)

    /* batch write the maps by route id */
    const batchMapWrites = arrayUtils
      .chunk(mapItems.map(dynamoService.toPutRequest), MAX_DYNAMO_REQUESTS)
      .reduce(async (store, items, i) => {
        await store

        return dynamoService.batchWrite(items)
      }, Promise.resolve([]) as Promise<Dynamo.BatchWriteOutput>)

    /* wait for all pending writes to finish */
    await batchStopWrites
    await batchMapWrites
    await singleWrites
    await searchStopWrite
  } catch (error) {
    winston.error(error)
  }

  /* log completion */
  winston.info('Done.')
}
