import { Deps } from "../depency-injector"
import * as Dynamo from "../services/dynamodb/types"
import * as Api from "../services/api/types"

import { winston } from "../utils/unicorns"
import * as listUtils from "../utils/lists"

type ApiDep = { api: Deps["api"] }
type DateDep = { date: Deps["date"] }
type DynamoDep = { dynamodb: Deps["dynamodb"] }

type StatusTuple = [string, Dynamo.PredictionStatus]

const CONNECTOR_KEY = process.env.CONNECTOR_KEY || ""
const MAX_DYNAMO_REQUESTS = 25

/**
 * Flatten the prediction item by making the `vehicleId` the
 * key and adding the original `predictionGroupId` key to the
 * prediction item itself so that it can later be used to
 * determine which prediction set this vehicle id belongs to.
 * @param entries
 * @example
 *  { '1': [vehicleId]: { predictionItem } } ->
 *  { [vehicleId]: { ...predictionItem, predictionGroupId: '1' } }
 */
export const flattenStatusItem = (entries: StatusTuple[]) =>
  entries.reduce((store, [predictionGroupId, predictionItemValue]) => {
    /* convert the vehicle prediction object into a list of tuples */
    const predictionItemEntries = Object.entries(predictionItemValue)
    const flatVehicles = predictionItemEntries.reduce(
      (store, [vehicleId, vehicleStatus]) => ({
        ...store,
        // adding the predictionGroupId here is the key to it all
        [vehicleId]: { ...vehicleStatus, predictionGroupId },
      }),
      {} as Dynamo.PredictionStatus
    )
    return { ...store, ...flatVehicles }
  }, {} as Dynamo.PredictionStatus)

/**
 * Get buses where their `isActive = false` or their
 * `wentOffline` time is greather than 10 minutes ago.
 * @param status
 * @param options
 */
export const getOfflineVehicleIds = (
  status: Dynamo.PredictionStatus,
  { date }: DateDep
) =>
  Object.entries(status).reduce(
    (store, [vehicleId, bus]) =>
      !bus.isActive && date.elapsedMinsGreaterThan(bus.wentOffline, 10)
        ? [...store, vehicleId]
        : store,
    [] as string[]
  )

/**
 * Get the `vehicleIds` of the vehicles that are now returning api results.
 * @param vehicles
 */
export const getAwakenedVehicleIds = (vehicles: Api.ConnectorApiVehicle[]) =>
  vehicles.reduce((store, vehicle) => {
    /* these vehicles are back online */
    if (vehicle.vehicle) {
      /* add the vids to the store so they can be updated in dynamodb */
      const vids = vehicle.vehicle.map(({ vid }) => vid)
      const vehicles = vids.join(", ")
      const message = `The following buses are back online: ${vehicles}.`
      // winston.info(message)
      return [...store, ...vids]
    }
    return store
  }, [] as string[])

type StatusParams = {
  flatVehicleStatus: Dynamo.PredictionStatus
  initialVehicleStatus: Dynamo.Status
}

/**
 * Create a new active or dormant vehicle object for the vehicle status item.
 * Note that both the `flatVehicleStatus` and the `vehicleStatus` are the same data.
 * The difference is that the vehicle status is either the dormant or active object
 * in its raw form, and the flatVehicleStatus is that object, but flattened so that
 * `vehicleId` is the key rather than the `predictionGroupId` and the `predictionGroupId`
 * is a property on each item.
 * @param awakenedVehiclesId
 * @param params
 */
export const getVehicleStatusItem = (
  awakenedVehiclesId: string[],
  { flatVehicleStatus, initialVehicleStatus }: StatusParams
) =>
  awakenedVehiclesId.reduce((store, vehicleId, i) => {
    const errorKey = `error-getting-prediction-item-id-${i}`
    /* get the prediction id of the vehicle from the flattened vehicle status */
    const { predictionGroupId = errorKey } = flatVehicleStatus[vehicleId]
    // const { predictionItemId } = flatVehicleStatus[vehicle.vid]

    /* get the previous state of this prediction */
    const predictionItem = store[predictionGroupId]
    const activeStatus = { isActive: true, wentOffline: null }
    return {
      ...store,
      [predictionGroupId]: { ...predictionItem, [vehicleId]: activeStatus },
    }
  }, initialVehicleStatus)

/**
 * Group the `stopIds` by `routeId`.
 * @param vehicleStops
 */
export const groupVehicleStopsByRoute = (vehicleStops: Dynamo.VehicleStop[]) =>
  vehicleStops.reduce((store, vehicleStop) => {
    /* check if this route exists in the store */
    const routeInfo = store[vehicleStop.routeId]

    /* if the route was  */
    if (routeInfo) {
      /* check if this stop exists in the route */
      const stopData = routeInfo[vehicleStop.stopId]

      if (!stopData) {
        /* add the stop to the route object */
        return {
          ...store,
          [vehicleStop.routeId]: {
            ...routeInfo,
            [vehicleStop.stopId]: vehicleStop,
          },
        }
      }

      const warning = `Found duplicate data for stopId ${vehicleStop.stopId} in route ${vehicleStop.routeId}. Skipping.`
      /* log error as two stops with the same stop id should not exist for a route */
      // winston.info(warning)
      return store
    }

    /* otherwise, create the route, and add the first stop to it */
    return {
      ...store,
      [vehicleStop.routeId]: { [vehicleStop.stopId]: vehicleStop },
    }
  }, {} as Dynamo.VehicleStopGroup)

/**
 * Create the dynamodb items for each vehicle stop group.
 */
export const createVehicleStopItems = (
  stopsGroupedByRoute: Dynamo.VehicleStopGroup,
  { dynamodb, date }: DynamoDep & DateDep
) =>
  Object.entries(stopsGroupedByRoute).reduce((store, [routeId, stops]) => {
    const item = dynamodb.createItem({
      pk: "stop",
      sk: `route_id_${routeId}`,
      dateCreated: date.getNowInISO(),
      stops,
    })
    return [...store, item]
  }, [] as Record<string, unknown>[])

/**
 * Get every vehicle stop using the connector api as the exclusive data source.
 * This function is only called if there are no stops in the database
 * where pk="stop" and sk begins_with "route_id_".
 * @param deps
 */
export const getVehicleStopApiCount = async (deps: Deps) => {
  const { api, date, dynamodb } = deps
  const params = { key: CONNECTOR_KEY, format: "json" } as const
  const { vehicleStops, stopApiCount } = await api.getEveryVehicleStop(params)
  // winston.info({ stopsLength: stops.length, stopApiCount })
  const groupedVehicleStops = groupVehicleStopsByRoute(vehicleStops)
  const vehicleStopItems = createVehicleStopItems(groupedVehicleStops, {
    dynamodb,
    date,
  })
  const putRequests = vehicleStopItems.map(dynamodb.toPutRequest)
  /* chunk the put requests and save them to dynamodb */
  const batchedVehicleStopGroups = listUtils.chunk(
    putRequests,
    MAX_DYNAMO_REQUESTS
  )
  /* 📍save the batches to the database */
  await batchedVehicleStopGroups.reduce(
    async (store, items) =>
      /* save the chunked items one 25 item list at a time */
      store.then(() => dynamodb.batchWriteItem(items)),
    Promise.resolve([]) as Promise<Dynamo.BatchWriteOutput>
  )

  /* experimental: create a list of all stops (some 2700) that can later be searched */
  const listOfVehicleStops = vehicleStops.reduce((store, vehicleStop) => {
    const matchStop = (item: Api.VehicleStop) =>
      item.stopId === vehicleStop.stopId &&
      item.stopName === vehicleStop.stopName
    const hasStop = store.some(matchStop)
    if (hasStop) return store
    return [...store, vehicleStop]
  }, [] as Api.VehicleStop[])

  /* the only single upload that needs to be conditional or it will overwrite */
  /* list of 2700+ stops  */
  if (listOfVehicleStops.length > 0) {
    /* create a dynamo item that includes a list of all the stops */
    const stopSearchItem = dynamodb.createItem({
      pk: "stop",
      sk: "search",
      dateCreated: date.getNowInISO(),
      stops: listOfVehicleStops,
    })
    /* 📍save the single-item searchable stop list to the database */
    await dynamodb.writeItem(stopSearchItem)
  }
  return stopApiCount
}

/**
 * Get every map marker using the connector api as the exclusive data source.
 * This function is only called if there are no stops in the database
 * where pk="stop" and sk begins_with "route_id_".
 * @param deps
 */
export const getMapMarkerApiCount = async (deps: Deps) => {
  const { api, date, dynamodb } = deps
  const params = { key: CONNECTOR_KEY, format: "json" } as const
  /* query the api for every map marker of every route */
  const { mapMarkers, mapApiCount } = await api.getEveryMapMarker(params)

  /* create the items for the maps */
  const mapMarkerItems = mapMarkers.map(({ key, map }) =>
    dynamodb.createItem({
      pk: "route",
      sk: key,
      dateCreated: date.getNowInISO(),
      map,
    })
  )
  const putRequests = mapMarkerItems.map(dynamodb.toPutRequest)
  /* batch write the maps by route id */
  const batchedMapMarkers = listUtils
    /* chunk the put requests and save them to dynamodb */
    .chunk(putRequests, MAX_DYNAMO_REQUESTS)

  /**
   * 📍Save each batch of map markers to the database. This is most
   * likely the most expensive write operation because the number of
   * items ventures into the tens of thousands.
   */
  await batchedMapMarkers.reduce(
    async (store, items) =>
      /* save the chunked items one 25 item list at a time */
      store.then(() => dynamodb.batchWriteItem(items)),
    Promise.resolve([]) as Promise<Dynamo.BatchWriteOutput>
  )
  return mapApiCount
}
