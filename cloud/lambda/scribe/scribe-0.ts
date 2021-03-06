import * as lambda from "aws-lambda"
import { winston, print } from "../utils/unicorns"

/* import utils */
import * as apiUtils from "../utils/api"
import * as listUtils from "../utils/lists"
import * as scribeUtils2 from "./scribe-utils"
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

  const reorganizationDeps = { ...deps, params }
  const {
    statusOfVehicles,
    routeApiCount,
  } = await scribeUtils2.reorganizeVehicleStatus(
    previousVehicleStatusItem,
    reorganizationDeps
  )

  const flatStatusItem = scribeUtils.flattenStatusItem(statusOfVehicles)
  const activeVehicleIds = scribeUtils.getVehicleIds(flatStatusItem)
  const chunkedVehicleIds = listUtils.chunk(activeVehicleIds, 10)
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
  /* create the vehicle status item */
  const vehicleStatusItem = dynamodb.createItem({
    pk: "vehicle",
    sk: "status",
    active,
    dormant,
  })
  const saveVehicleStatus = dynamodb
    .writeItem(vehicleStatusItem)
    .catch((error: Error) => {
      console.log("Error: failed to save pk:vehicle sk:status item.")
      throw error
    })

  /* --------------- update predictions of active vehicles only --------------- */

  /* get the vehicle predictions for each batch of vehicle ids */
  const predictions = await scribeUtils.getApiResponse<
    Api.ConnectorPredictionOrError
  >("predictions", {
    api,
    batchedVehicleParams, // vehicles where `isActive=true`
  })

  /* create the predictions map */
  const apiPredictionMap = scribeUtils.createPredictionMap(predictions, {
    date,
  })

  const predictionItemDeps = { dynamodb, vehicles, apiPredictionMap, date }

  // Object.values(active).map((v) => {
  //   const keys = Object.keys(v)
  //   console.log({ groupLength: keys.length })
  // })

  // use the active status as a foundation to generate prediction items
  const predictionItems = await scribeUtils.getPredictionItems(
    active,
    predictionItemDeps
  )

  await predictionItems.reduce(async (store, pastItem) => {
    const flattenedPredictions = await store
    const { id: predictionItemId } = pastItem
    const routes = scribeUtils.createVehicleStruct(flattenedPredictions, {
      currentVehicles: vehicles,
      pastVehicles: pastItem,
      date,
    })

    const allVehicles = Object.keys(routes).length

    // const numOfVids = allVehicles.length
    // const numOfPastVids = Object.keys(pastItem.routes).length
    // console.log("group id:", predictionItemId)
    // console.log("num of vids in past route (item):", numOfPastVids)
    // console.log("num of vids in new route:", numOfVids)

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

    const saveVehicle = dynamodb.writeItem(vehicleItem).catch((error) => {
      console.log(
        `Error: failed to save pk:active-prediction sk:${predictionItemId} item with item:`
      )
      throw new Error(error)
    })

    const saveHistory = dynamodb.writeHistoryItem(vehicleHistoryItem)

    /* ---------------------- trigger the graphql mutation ---------------------- */

    const mutationParams = {
      endpoint: GRAPHQL_ENDPOINT,
      apiKey: GRAPHQL_API_KEY,
    }
    const triggerSubscription = api
      .triggerVehicleMutation(mutationParams, String(predictionItemId))
      .catch((error: Error) => {
        if (error.message.includes("401")) {
          console.log(
            "Error: Mutation api call failed with 401. If you are still using an API key, it has likely expired. Please check the appsync console."
          )
        }
        throw error
      })

    await Promise.all([saveVehicle, saveHistory, triggerSubscription])

    // TODO: somehow, only the unused vehicles should be returned, that way
    // TODO: you can later create new prediction items with the leftovers
    return flattenedPredictions
  }, Promise.resolve(apiPredictionMap))

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
