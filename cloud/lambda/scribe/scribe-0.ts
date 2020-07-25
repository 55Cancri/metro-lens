import * as lambda from "aws-lambda"
import { winston, print } from "../utils/unicorns"

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

  /* ------------------ update the status of active vehicles ------------------ */

  /* get the status item */
  const previousVehicleStatusItem = await dynamodb.getVehicleStatus()

  /* define the api params in case the api call needs to be made */
  const params = { key: CONNECTOR_KEY, format: "json" } as const
  const statusItemIsEmpty = objectUtils.objectIsEmpty(
    previousVehicleStatusItem.statusOfVehicles
  )
  const vehicleStatus = statusItemIsEmpty
    ? await api.getActiveVehicles(params)
    : previousVehicleStatusItem
  const { statusOfVehicles, routeApiCount } = vehicleStatus

  const flatStatusItem = scribeUtils.flattenStatusItem(statusOfVehicles)

  /* get the vehicle ids of the active vehicles */
  const activeVehicleIds = scribeUtils.getVehicleIds(flatStatusItem)

  /* chunk the vehicle ids into lengths of 10, the limit in a single api call */
  const chunkedVehicleIds = listUtils.chunk(activeVehicleIds, 10)

  /* convert the api calls into api param objects */
  const batchedVehicleParams = apiUtils.getApiParams(chunkedVehicleIds)

  /* get the vehicle location for each batch of vehicle ids */
  const vehicles = await scribeUtils.getApiResponse<
    Api.ConnectorVehicleOrError
  >("vehicles", {
    api,
    batchedVehicleParams, // vehicles where `isActive=true`
  })

  // target a specific vehicle
  // console.log(`active vids: ${activeVehicleIds.join(", ")}`)

  // print(
  //   vehicles.reduce((store, v) => {
  //     if ("msg" in v) {
  //       console.log("Incoming message: ", v.msg)
  //       return store
  //     }
  //     return { ...store, [v.vid]: { lat: v.lat, lon: v.lon } }
  //   }, {})
  // )

  const updatedFlatStatus = scribeUtils.updateFlatStatusItem(
    vehicles,
    flatStatusItem
  )
  const { active, dormant = {} } = scribeUtils.assembleStatusItem(
    updatedFlatStatus
  )

  // print({ statusOfVehicles, routeApiCount })
  // print({ newActive: active, routeApiCount })
  console.log("Made a ton of api calls above.")
  // print({ newActive: active, newDormant: dormant })
  // print({ newActive: active, newDormant: dormant })

  /* create the vehicle status item */
  const vehicleStatusItem = dynamodb.createItem({
    pk: "vehicle",
    sk: "status",
    active,
    dormant,
  })
  const saveVehicleStatus = dynamodb.writeItem(vehicleStatusItem)

  /* --------------- update predictions of active vehicles only --------------- */

  /* get the vehicle predictions for each batch of vehicle ids */
  const predictions = await scribeUtils.getApiResponse<
    Api.ConnectorPredictionOrError
  >("predictions", {
    api,
    batchedVehicleParams, // vehicles where `isActive=true`
  })

  /* create the predictions map */
  const predictionMap = scribeUtils.createPredictionMap(predictions, { date })

  // /* get the array of prediction items */
  // const predictionItems = await dynamodb.getActivePredictions()
  const predictionItems = await scribeUtils.getPredictionItems(vehicles, {
    dynamodb,
    predictionMap,
  })

  print({ finalPredictionItemsLength: predictionItems.length })

  /*create a timestamp for the current moment */
  const lastUpdateTime = date.getNowInISO()

  await predictionItems.reduce(async (store, pastItem) => {
    const flattenedPredictions = await store
    const { id: predictionItemId, allVehicles } = pastItem
    const routes = scribeUtils.createVehicleStruct(flattenedPredictions, {
      currentVehicles: vehicles,
      pastVehicles: pastItem,
      lastUpdateTime,
    })

    const vehicleItem = dynamodb.createItem({
      pk: "active-predictions",
      sk: predictionItemId,
      allVehicles,
      routes,
    })

    const vehicleHistoryItem = dynamodb.createHistoryItem({
      pk: "vehicle_predictions_history",
      sk: date.getNowInISO(),
      id: predictionItemId,
      allVehicles,
      routes,
      TTL: date.setTTLExpirationIn({ days: 1 }),
    })

    const saveVehicle = dynamodb.writeItem(vehicleItem)
    const saveHistory = dynamodb.writeHistoryItem(vehicleHistoryItem)

    /* ---------------------- trigger the graphql mutation ---------------------- */

    const mutationParams = {
      endpoint: GRAPHQL_ENDPOINT,
      apiKey: GRAPHQL_API_KEY,
    }
    const triggerSubscription = api.triggerVehicleMutation(
      mutationParams,
      String(predictionItemId)
    )

    await Promise.all([saveVehicle, saveHistory, triggerSubscription])

    // TODO: somehow, only the unused vehicles should be returned, that way
    // TODO: you can later create new prediction items with the leftovers
    return flattenedPredictions
  }, Promise.resolve(predictionMap))

  /* ---------------------- count the number of api calls --------------------- */

  const vehicleApiCount = chunkedVehicleIds.length
  const predictionsApiCount = chunkedVehicleIds.length
  const previousApiTotal = await dynamodb.getApiCountTotal()
  const sessionApiCount = routeApiCount + vehicleApiCount + predictionsApiCount
  const totalApiCount = Number(previousApiTotal) + sessionApiCount

  const totalApiCountItem = dynamodb.createItem({
    pk: "api_count",
    sk: "total",
    lastUpdatedBy: "scribe",
    lastUpdated: date.getNowInISO(),
    apiCountTotal: totalApiCount,
  })
  const recentApiCountItem = dynamodb.createHistoryItem({
    pk: "api_count_history",
    sk: date.getNowInISO(),
    calledBy: "scribe",
    apiCount: sessionApiCount,
    TTL: date.setTTLExpirationIn({ years: 1 }),
  })
  const saveTotalApiCounts = dynamodb.writeItem(totalApiCountItem)
  const saveRecentApiCounts = dynamodb.writeHistoryItem(recentApiCountItem)
  await Promise.all([
    saveVehicleStatus,
    saveTotalApiCounts,
    saveRecentApiCounts,
  ])
}
