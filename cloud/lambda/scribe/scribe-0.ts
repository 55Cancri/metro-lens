import * as lambda from "aws-lambda"
import { winston } from "../utils/unicorns"

/* import utils */
import * as apiUtils from "../utils/api"
import * as objectUtils from "../utils/objects"
import * as listUtils from "../utils/lists"
import * as scribeUtils from "./utils"

/* import types */
import { Deps } from "../depency-injector"
import * as Api from "../types/api"

/* define the constants */
const CONNECTOR_KEY = process.env.CONNECTOR_KEY || ""
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || ""
const GRAPHQL_API_KEY = process.env.GRAPHQL_API_KEY || ""

export const scribe = (deps: Deps) => async (
  event?: lambda.APIGatewayEvent
) => {
  /* extract the dependencies */
  const { dynamodb, api, date } = deps

  /* get the status item */
  const previousVehicleStatusItem = await dynamodb.getVehicleStatus()

  /* define the api params in case the api call needs to be made */
  const params = { key: CONNECTOR_KEY, format: "json" } as const

  const vehicleStatus = objectUtils.objectIsEmpty(previousVehicleStatusItem)
    ? await api.getActiveVehicles(params)
    : previousVehicleStatusItem

  const { statusOfVehicles, routeApiCount } = vehicleStatus

  /* extract the active and dormant prediction sets */
  const { active, dormant } = statusOfVehicles

  /* flatten the active and dormant vehicle status' */
  const flatActiveStatus = scribeUtils.flattenStatusItem(active)
  const flatDormantStatus = scribeUtils.flattenStatusItem(dormant)

  /* flatten the vehicle status */
  const flatVehicleStatus = { ...flatActiveStatus, ...flatDormantStatus }

  /* get the vehicle ids of the active vehicles */
  const activeVehicleIds = scribeUtils.getVehicleIds(flatVehicleStatus)

  /* chunk the vehicle ids into lengths of 10, the limit in a single api call */
  const chunkedVehicleIds = listUtils.chunk(activeVehicleIds, 10)

  /* convert the api calls into api param objects */
  const batchedVehicleParams = apiUtils.getApiParams(chunkedVehicleIds)

  /* get the vehicle location for each batch of vehicle ids */
  const vehiclesPromise = scribeUtils.getApiResponse(
    api,
    batchedVehicleParams
  ) as Promise<Api.ConnectorVehicleOrError[]>

  /* get the vehicle predictions for each batch of vehicle ids */
  const predictionsPromise = scribeUtils.getApiResponse(
    api,
    batchedVehicleParams
  ) as Promise<Api.ConnectorPredictionOrError[]>

  /* wait for the vehicle and prediction responses to come in */
  const [vehicles, predictions] = await Promise.all([
    vehiclesPromise,
    predictionsPromise,
  ])

  /* create the active and dormant vehicle status */
  const activeVehicleStatus = scribeUtils.getVehicleStatus(
    vehicles,
    flatVehicleStatus,
    flatActiveStatus
  )
  const dormantVehicleStatus = scribeUtils.getVehicleStatus(
    vehicles,
    flatVehicleStatus,
    flatDormantStatus
  )

  /* create the vehicle status item */
  const vehicleStatusItem = {
    entity: "vehicle",
    id: "status",
    active: activeVehicleStatus,
    dormant: dormantVehicleStatus,
  }

  /* create the predictions map */
  const predictionMap = scribeUtils.createPredictionMap(predictions, { date })

  /* get the array of prediction items */
  const predictionItems = await dynamodb.getVehiclePredictions()

  /*create a timestamp for the current moment */
  const lastUpdateTime = date.getNowInISO()

  /* determine the number of api calls made */
  const vehicleApiCount = chunkedVehicleIds.length
  const predictionsApiCount = chunkedVehicleIds.length

  /* get the historical total number of api calls made */
  const previousApiTotal = await dynamodb.getApiCountTotal()

  /* sum up all of the api calls */
  const apiCount = routeApiCount + vehicleApiCount + predictionsApiCount
  const apiCountTotal = Number(previousApiTotal) + apiCount

  const recentApiCountConfig = {
    pk: "api_count_history",
    sk: date.getNowInISO(),
    calledBy: "scribe",
    apiCount,
    TTL: date.setTTLExpirationIn({ years: 1 }),
  }

  const totalApiCountConfig = {
    pk: "api_count",
    sk: "total",
    lastUpdatedBy: "scribe",
    lastUpdated: date.getNowInISO(),
    apiCountTotal,
  }

  const apiCallSummary = `Api Calls :: Routes: ${routeApiCount}. Vehicles: ${vehicleApiCount}. Predictions: ${predictionsApiCount}.`

  winston.info(apiCallSummary)

  /* update the total api calls in the main table */
  const totalApiCountItem = dynamodb.createItem(totalApiCountConfig)

  /* add a new entry in the history table for the recent number of api calls */
  const recentApiCountItem = dynamodb.createHistoryItem(recentApiCountConfig)

  /* save the api counts */
  const saveTotalApiCounts = dynamodb.writeItem(totalApiCountItem)
  const saveRecentApiCounts = dynamodb.writeHistoryItem(recentApiCountItem)

  await Promise.all([saveTotalApiCounts, saveRecentApiCounts])

  /* iterate and update each prediction item */
  predictionItems.map(async (item, i) => {
    /* define the prediction item number starting at 1 */
    const predictionItemId = i + 1

    /* create a new vehicle item from the old and new vehicles */
    const vehicleStruct = scribeUtils.createVehicleStruct(predictionMap, {
      currentVehicles: vehicles,
      pastVehicles: item,
      lastUpdateTime,
    })

    /* create a new prediction item */
    const config = {
      pk: "prediction",
      sk: predictionItemId,
      routes: vehicleStruct,
    }

    /* create a historical record of the prediction item */
    const historyConfig = {
      pk: "vehicle_predictions_history",
      sk: date.getNowInISO(),
      id: predictionItemId,
      routes: vehicleStruct,
      // routes: vehicleMap,
      TTL: date.setTTLExpirationIn({ days: 1 }),
    }

    /* create the items */
    const vehicleItem = dynamodb.createItem(config)
    const vehicleHistoryItem = dynamodb.createHistoryItem(historyConfig)

    /* save the items */
    const saveVehicle = dynamodb.writeItem(vehicleItem)
    const saveHistory = dynamodb.writeHistoryItem(vehicleHistoryItem)

    const mutationParams = {
      endpoint: GRAPHQL_ENDPOINT,
      apiKey: GRAPHQL_API_KEY,
    }
    const mutationResult = api.triggerVehicleMutation(
      mutationParams,
      predictionItemId
    )

    return Promise.all([saveVehicle, saveHistory, mutationResult])
  })
}
