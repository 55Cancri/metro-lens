import * as Api from "../types/api"
import * as Dynamo from "../services/dynamodb/types"
import { Deps } from "../depency-injector"
import * as unicornUtils from "../utils/unicorns"

const { winston } = unicornUtils

type PredictionMap = Record<string, Dynamo.Prediction[]>

/**
 *
 * @param status receives an object like the following:
 * {
 *  '1': {
 *    '7708': {
 *      isActive: false,
 *      wentOffline: '2020-06-27T20:01:49.236Z'
 *    }
 *    ...
 *  }
 *  ...
 * }
 *
 * @returns
 * {
 *  '7708': {
 *    isActive: false,
 *    wentOffline: '2020-06-27T20:01:49.236Z',
 *    predictionItemId: '1'
 *  }
 *  ...
 * }
 */
export const flattenStatusItem = (
  status: Dynamo.Status
): Dynamo.PredictionIdStatus => {
  // convert to: [ ['1', { '7708': { isActive, wentOffline } }], ... ]
  const entries = Object.entries(status)

  return entries.reduce(
    (outerStore, [predictionItemId, predictionItemValue]) => {
      // convert to: [ ['7708', { isActive, wentOffline }], ... ]
      const predictionItemEntries = Object.entries(predictionItemValue)

      // convert to: { '7708', { isActive, wentOffline, predictionItemId }, ... }
      const flatVehicles = predictionItemEntries.reduce(
        (innerStore, [vehicleId, vehicleStatus]) => ({
          ...innerStore,
          [vehicleId]: { ...vehicleStatus, predictionItemId },
        }),
        {}
      )

      return { ...outerStore, ...flatVehicles }
    },
    {}
  )
}

/**
 * A vehicle is active if its `isActive` property is `true`,
 * otherwise it is discarded.
 * @param {Dynamo.PredictionIdStatus} flatStatus the flat map of vehicle ids
 */
export const getVehicleIds = (flatStatus: Dynamo.PredictionIdStatus) => {
  return Object.entries(flatStatus).reduce(
    (store, [key, { isActive }]) => (isActive ? [...store, key] : store),
    [] as string[]
  )
}

/**
 * Get the API responses for a list of vehicle ids.
 */
export const getApiResponse = async (
  api: Deps["api"],
  batchedVehicleIds: Api.HttpClientConnectorParams[]
) => {
  const response = (await Promise.all(
    batchedVehicleIds.map(api.getVehicleLocations)
  )) as (Api.ConnectorApiVehicle | Api.ConnectorApiPrediction)[]

  type ConnectorList =
    | Api.ConnectorVehicle
    | Api.ConnectorPrediction
    | Api.ConnectorError

  return response.reduce((store, vehicle) => {
    /* handle vehicle */
    if ("vehicle" in vehicle && vehicle.error) {
      return [...store, ...vehicle.vehicle!, ...vehicle.error]
    }

    if ("vehicle" in vehicle) {
      return [...store, ...vehicle.vehicle!]
    }

    /* handle predictions */
    if ("prd" in vehicle && vehicle.error) {
      return [...store, ...vehicle.prd!, ...vehicle.error]
    }

    if ("prd" in vehicle) {
      return [...store, ...vehicle.prd!]
    }

    /* handle exclusive errors */
    if ("error" in vehicle) {
      return [...store, ...vehicle.error]
    }

    return store
  }, [] as ConnectorList[])
}

export const getVehicleStatus = (
  vehicles: Api.ConnectorVehicleOrError[],
  flatVehicleStatus: Dynamo.PredictionIdStatus,
  flatInitialStatus: Dynamo.PredictionIdStatus
) =>
  vehicles.reduce(
    (store, vehicle) => {
      /* get the prediction id of the vehicle from the flattened vehicle status */
      const { predictionItemId } = flatInitialStatus[vehicle.vid]

      /* get the previous state of this prediction */
      const predictionItem = store[predictionItemId]

      /* there was an error */
      if ("msg" in vehicle) {
        return {
          ...store,
          [predictionItemId]: {
            ...predictionItem,
            [vehicle.vid]: {
              isActive: false,
              wentOffline: new Date().toISOString(),
            },
          },
        }
      }

      return {
        ...store,
        [predictionItemId]: {
          ...predictionItem,
          [vehicle.vid]: { isActive: true, wentOffline: null },
        },
      }
    },
    // { '1': { ... }, '2': { ... } }
    flatInitialStatus
  )

/**
 * Create flattened map of the predictions so that when
 * iterating over the predictions and creating the new prediction
 * sets, it will be able to look up the latest prediction info
 * in constant time.
 * @param predictions
 */
export const createPredictionMap = (
  predictions: Api.ConnectorPredictionOrError[],
  { date }: { date: Deps["date"] }
) =>
  predictions.reduce((store, prediction) => {
    /* if there is a message prop, it means there was an error */
    if ("msg" in prediction) {
      /* so log it, and throw it away */
      winston.warn(`Bus ${prediction.vid} has gone offline.`)

      return store
    }

    /* otherwise extract the relevant values from the prediction */
    const { rt, vid, stpid, stpnm, prdtm, prdctdn } = prediction

    /* create key */
    const routeIdVehicleId = `${rt}_${vid}`

    /* determine the time from arrival */
    const arrivalIn = /due/i.test(prdctdn) ? "0" : prdctdn

    /* and the arrival time */
    const arrivalTime = date.parsePredictedTime(prdtm)

    /* and create an eta */
    const eta = { arrivalIn, arrivalTime, stopName: stpnm, stopId: stpid }

    /* if the store has encountered this route id / vehicle id object before, */
    if (store[routeIdVehicleId]) {
      /* merge the new prediction object in the array */
      return { ...store, [routeIdVehicleId]: [...store[routeIdVehicleId], eta] }
    }

    /* otherwise create a new eta for the route id / vehicle id object */
    return { ...store, [routeIdVehicleId]: [eta] }
  }, {} as PredictionMap)

/**
 * Create a new prediction item.
 * @param predictionMap
 * @param param1
 */
export const createVehicleStruct = (
  predictionMap: PredictionMap,
  {
    /** the latests results from the api call */
    currentVehicles,
    /** the route vehicle id from dynamo */
    pastVehicles,
    lastUpdateTime,
  }: {
    currentVehicles: Api.ConnectorVehicleOrError[]
    pastVehicles: Dynamo.VehiclePredictionItem
    lastUpdateTime: string
  }
) =>
  currentVehicles.reduce((store, vehicle) => {
    if ("msg" in vehicle) {
      return store
    }

    const { rt, vid: vehicleId, lat, lon } = vehicle

    const routeIdVehicleId = `${rt}_${vehicleId}`

    /* get the array of predictions for the route-vehicle id */
    const predictions = predictionMap[routeIdVehicleId] as Dynamo.Prediction[]

    const data = { rt, lat, lon, vehicleId, predictions, lastUpdateTime }

    return { ...store, [routeIdVehicleId]: data }
  }, pastVehicles)
