import R from "ramda"

import * as Api from "../types/api"
import * as Dynamo from "../services/dynamodb/types"
import { Deps } from "../depency-injector"

import * as unicornUtils from "../utils/unicorns"
import * as listUtils from "../utils/lists"

const { print, winston } = unicornUtils

const ACTIVE_PREDICTION_SET_SIZE = process.env.ACTIVE_PREDICTION_SET_SIZE
  ? Number(process.env.ACTIVE_PREDICTION_SET_SIZE)
  : 25

type PredictionMap = Record<string, Dynamo.PredictionWithDirection[]>

/**
 *
 * @param status receives an object like the following:
 * {
 *  '1': {
 *    '7708': {
 *      isActive: false,
 *      wentOffline: '2020-06-27T20:01:49.236Z'
 *    },
 *    '7710': { ... }
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
 *  },
 *  '7710': { ... }
 *  ...
 * }
 */

/**
 * The issue is that normal status item looks like this:
 * {
 *  active: {
 *    1: {
 *      401_7712: { ... }
 *    }
 *  }
 * }
 *
 * but fetching from api looks like this:
 * {
 *  active: {
 *    7712: { ... }
 *  }
 * }
 * @param statusGroupName
 * @param statusGroupEntries
 */
const flatten = (
  statusGroupName: "active" | "dormant",
  statusGroupEntries: Dynamo.PredictionEntry[]
) =>
  statusGroupEntries.reduce(
    (store, [predictionGroupId, predictionVehicles]) => {
      const predictionItemEntries = Object.entries(predictionVehicles)
      const flatVehicles = predictionItemEntries.reduce(
        (store, [vehicleId, vehicleStatus]) => ({
          ...store,
          [vehicleId]: { ...vehicleStatus, predictionGroupId, statusGroupName },
        }),
        {}
      ) as Dynamo.MetadataPredictionStatus
      return { ...store, ...flatVehicles }
    },
    {} as Dynamo.MetadataPredictionStatus
  )

export const flattenStatusItem = (statusItem: Dynamo.VehicleStatusItem) => {
  const { active, dormant } = statusItem
  const activeBusEntries = Object.entries(active)
  const dormantBusEntries = Object.entries(dormant)
  const activeFlatStatus = flatten("active", activeBusEntries)
  const dormantFlatStatus = flatten("dormant", dormantBusEntries)
  return { ...dormantFlatStatus, ...activeFlatStatus }
}

export const updateFlatStatusItem = (
  vehicles: Api.ConnectorVehicleOrError[],
  flatStatusItem: Dynamo.MetadataPredictionStatus
) =>
  vehicles.reduce((store, vehicle) => {
    const vehicleItem = store[vehicle.vid]

    if ("msg" in vehicle) {
      return {
        ...store,
        [vehicle.vid]: {
          ...vehicleItem,
          isActive: false,
          wentOffline: new Date().toISOString(),
        },
      }
    }

    return {
      ...store,
      [vehicle.vid]: {
        ...vehicleItem,
        isActive: true,
        wentOffline: null,
      },
    }
  }, flatStatusItem)

export const assembleStatusItem = (
  updatedFlatStatus: Dynamo.MetadataPredictionStatus
) =>
  Object.entries(updatedFlatStatus).reduce(
    (store, [vehicleId, vehicleStatus]) => {
      const { predictionGroupId, statusGroupName, ...status } = vehicleStatus
      const statusGroup = (store[statusGroupName as keyof typeof store] ??
        {}) as Dynamo.Status
      const predictionItem = (statusGroup[predictionGroupId] ??
        {}) as Dynamo.PredictionStatus
      const vehicleItem = predictionItem[vehicleId] ?? {}
      return {
        ...store,
        [statusGroupName]: {
          ...statusGroup,
          [predictionGroupId]: {
            ...predictionItem,
            // TODO: vehicleItem may not be needed
            [vehicleId]: { ...vehicleItem, ...status },
          },
        },
      } as Dynamo.VehicleStatusItem
    },
    {} as Dynamo.VehicleStatusItem
  )

/**
 * A vehicle is active if its `isActive` property is `true`,
 * otherwise it is discarded.
 * @param {Dynamo.MetadataPredictionStatus} flatStatus the flat map of vehicle ids
 */
export const getVehicleIds = (flatStatus: Dynamo.MetadataPredictionStatus) => {
  return Object.entries(flatStatus).reduce(
    (store, [key, { isActive }]) => (isActive ? [...store, key] : store),
    [] as string[]
  )
}

type ApiType = "vehicles" | "predictions"

type Params = {
  api: Deps["api"]
  batchedVehicleParams: Api.HttpClientConnectorParams[]
}

/**
 * Get the API responses for a list of vehicle ids.
 */
export const getApiResponse = async <T>(
  type: ApiType,
  { api, batchedVehicleParams }: Params
): Promise<T[]> => {
  if (type === "vehicles") {
    const response = (await Promise.all(
      batchedVehicleParams.map(api.getVehicleLocations)
    )) as Api.ConnectorApiVehicle[]

    // @ts-ignore
    return response.reduce<T[]>((store, vehicle) => {
      /* handle vehicle */
      if ("vehicle" in vehicle && vehicle.error) {
        return [...store, ...vehicle.vehicle!, ...vehicle.error]
      }

      if ("vehicle" in vehicle) {
        return [...store, ...vehicle.vehicle!]
      }

      /* handle exclusive errors */
      if ("error" in vehicle) {
        const [error] = vehicle.error
        const { msg } = error
        if (/^(?=.*transaction)(?=.*limit)(?=.*exceeded).*$/i.test(msg)) {
          throw new Error(
            "Error: Transaction limit for current day has been exceeded."
          )
        }
        return [...store, ...vehicle.error]
      }

      return store
    }, [])
  }

  if (type === "predictions") {
    const response = (await Promise.all(
      batchedVehicleParams.map(api.getVehiclePredictions)
    )) as Api.ConnectorApiPrediction[]

    // @ts-ignore
    return response.reduce<T[]>((store, vehicle) => {
      /* handle predictions */
      if ("prd" in vehicle && vehicle.error) {
        return [...store, ...vehicle.prd!, ...vehicle.error]
      }

      if ("prd" in vehicle) {
        return [...store, ...vehicle.prd!]
      }

      /* handle exclusive errors */
      if ("error" in vehicle) {
        const [error] = vehicle.error
        const { msg } = error
        if (/^(?=.*transaction)(?=.*limit)(?=.*exceeded).*$/i.test(msg)) {
          throw new Error(
            "Error: Transaction limit for current day has been exceeded."
          )
        }
        return [...store, ...vehicle.error]
      }

      return store
    }, [])
  }

  return []
}

// function takes the active vehicles (obtained from both the active and dormant objects)
// and the original active and dormant objects
//

export const updateVehicleStatus = (
  vehicles: Api.ConnectorVehicleOrError[],
  flatVehicleStatus: Dynamo.MetadataPredictionStatus,
  flatInitialStatus: Dynamo.MetadataPredictionStatus
) =>
  vehicles.reduce(
    (store, vehicle) => {
      /* get the prediction id of the vehicle from the flattened vehicle status */
      const { predictionGroupId = "" } = flatInitialStatus[vehicle.vid]

      /* get the previous state of this prediction */
      const predictionItem = store[predictionGroupId]

      /* there was an error */
      if ("msg" in vehicle) {
        return {
          ...store,
          [predictionGroupId]: {
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
        [predictionGroupId]: {
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
    const { rt, vid, stpid, stpnm, prdtm, prdctdn, rtdir } = prediction

    /* create key */
    const routeIdVehicleId = `${rt}_${vid}`

    /* determine the time from arrival */
    const arrivalIn = /due/i.test(prdctdn) ? "0" : prdctdn

    /* and the arrival time */
    const arrivalTime = date.parsePredictedTime(prdtm)

    /* and create an eta */
    const eta = {
      arrivalIn,
      arrivalTime,
      stopName: stpnm,
      stopId: stpid,
      routeDirection: rtdir,
    }

    /* if the store has encountered this route id / vehicle id object before, */
    if (store[routeIdVehicleId]) {
      /* merge the new prediction object in the array */
      return { ...store, [routeIdVehicleId]: [...store[routeIdVehicleId], eta] }
    }

    /* otherwise create a new eta for the route id / vehicle id object */
    return { ...store, [routeIdVehicleId]: [eta] }
  }, {} as PredictionMap)

/**
 * Get the route direction and remove from each prediction item.
 * @param vehiclePredictions
 */
const getDirectionAndPredictions = (
  vehiclePredictions: Dynamo.PredictionWithDirection[]
) => {
  const { routeDirection } = vehiclePredictions[0] ?? {}
  const predictions = vehiclePredictions.map(
    ({ routeDirection, ...vehiclePrediction }) => vehiclePrediction
  )
  return { routeDirection, predictions }
}

/**
 * Create a new prediction item.
 * NOTE: only the updated vehicles should have their
 * `lastUpdateTime` updated time. The others should
 * remain as they were.
 * @param predictionMap
 * @param vehicleParams
 */
export const createVehicleStruct = (
  predictionMap: PredictionMap,
  {
    /** the latests results from the api call */
    currentVehicles,
    /** the route vehicle id from dynamo */
    pastVehicles,
    date,
  }: {
    currentVehicles: Api.ConnectorVehicleOrError[]
    pastVehicles: Dynamo.VehiclePredictionItem
    date: Deps["date"]
  }
) => {
  /**
   * Limit the size of the prediction objects based on expiration time.
   */
  const filteredPastRoutes = Object.entries(pastVehicles.routes).reduce(
    (store, routeVehicle) => {
      const [routeIdVehicleId, vehicle] = routeVehicle as [
        string,
        Dynamo.Vehicle
      ]
      const differenceInHours = date.getDifferenceInHours(
        new Date(),
        new Date(vehicle.lastUpdateTime)
      )
      const absoluteDifferenceInHours = Math.abs(differenceInHours)
      const recentlyUpdated = absoluteDifferenceInHours < 12
      const hasPredictions =
        vehicle.predictions && vehicle.predictions.length > 0
      const hasRouteDirection = vehicle.routeDirection

      return recentlyUpdated && hasPredictions && hasRouteDirection
        ? { ...store, [routeIdVehicleId]: vehicle }
        : store
    },
    {}
  )

  return currentVehicles.reduce((store, vehicle) => {
    if ("msg" in vehicle) return store
    const {
      rt,
      vid: vehicleId,
      lat,
      lon,
      spd,
      des: destination,
      tmstmp,
    } = vehicle
    const routeIdVehicleId = `${rt}_${vehicleId}`

    // get the array of predictions for the route-vehicle id
    const mph = String(spd)
    const vehiclePredictions = predictionMap[
      routeIdVehicleId
    ] as Dynamo.PredictionWithDirection[]
    const { routeDirection, predictions } = getDirectionAndPredictions(
      vehiclePredictions ?? []
    )
    const lastLocation = {}
    const currentLocation = { lat, lon }
    const lastUpdateTime = date.getNowInISO()
    const sourceTimestamp = date.getSourceTimestamp(tmstmp)

    const updatedLocationAndPrediction = {
      rt,
      vehicleId,
      routeDirection,
      mph,
      destination,
      lastLocation,
      currentLocation,
      lastUpdateTime,
      predictions,
      sourceTimestamp,
    }
    if (predictions.length > 0) {
      return { ...store, [routeIdVehicleId]: updatedLocationAndPrediction }
    }
    return store
  }, filteredPastRoutes)
}

/**
 * Map all active vehicles obtained from the api call into
 * dynamo vehicle objects keyed by routeIdVehicleId.
 * @param vehicles
 * @param param1
 */
const getPredictionList = (
  vehicles: Api.ConnectorVehicleOrError[],
  { predictionMap, date }: { predictionMap: PredictionMap; date: Deps["date"] }
) =>
  vehicles.reduce((store, vehicle) => {
    if ("msg" in vehicle) return store
    const {
      rt,
      vid: vehicleId,
      lat,
      lon,
      spd,
      des: destination,
      tmstmp,
    } = vehicle
    // treat all `routeIdVehicleIds` as a single unique vehicle
    const routeIdVehicleId = `${rt}_${vehicleId}`
    const vehiclePredictions = predictionMap[routeIdVehicleId]
    const { routeDirection, predictions } = getDirectionAndPredictions(
      vehiclePredictions ?? []
    )
    const lastUpdateTime = date.getNowInISO()
    const mph = String(spd)
    const lastLocation = {}
    const currentLocation = { lat, lon }
    const sourceTimestamp = date.getSourceTimestamp(tmstmp)
    const locationAndPrediction: Dynamo.Vehicle = {
      rt,
      vehicleId,
      routeDirection,
      mph,
      destination,
      lastLocation,
      currentLocation,
      lastUpdateTime,
      predictions,
      sourceTimestamp,
    }
    const routeIdVehicleIdItem = { [routeIdVehicleId]: locationAndPrediction }
    return store.concat([routeIdVehicleIdItem])
  }, [] as Dynamo.Routes[])

/**
 * Map the routeIdVehicleId objects into active-prediction items.
 * @param chunkedPredictionList
 */
const createPredictionItems = (chunkedPredictionList: Dynamo.Routes[][]) =>
  chunkedPredictionList.map((predictionChunk, i) => {
    type InitialState = { routes: Dynamo.Routes; allVehicles: string[] }
    const predictionItemId = i + 1

    const { routes, allVehicles } = predictionChunk.reduce(
      (store, routeIdVehicleId) => {
        const [[key, vehicle]] = Object.entries(routeIdVehicleId)
        const updatedRoutes = { ...store.routes, [key]: vehicle }
        const [, vehicleId] = key.split("_")
        const updatedVehicles = store.allVehicles.concat([vehicleId])
        return { routes: updatedRoutes, allVehicles: updatedVehicles }
      },
      { routes: {}, allVehicles: [] } as InitialState
    )

    const entity = "active-predictions"
    const id = String(predictionItemId)
    const item = { entity, id, routes, allVehicles }
    return item
  })

/**
 * Get the active-prediction items from the database if they exist,
 * or recreate them from the api vehicles and the prediction map.
 */
export const getPredictionItems = async (
  vehicles: Api.ConnectorVehicleOrError[],
  params: {
    predictionMap: PredictionMap
    dynamodb: Deps["dynamodb"]
    date: Deps["date"]
  }
) => {
  const { dynamodb, predictionMap, date } = params

  // attempt to get existing active-prediction items
  const predictionItems = await dynamodb.getActivePredictions()
  if (predictionItems.length > 0) return predictionItems

  const predictionList = getPredictionList(vehicles, { predictionMap, date })
  const chunkedPredictionList = listUtils.chunk(
    predictionList,
    ACTIVE_PREDICTION_SET_SIZE
  )

  const createdPredictionItems = createPredictionItems(chunkedPredictionList)
  return createdPredictionItems
}
