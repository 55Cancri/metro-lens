/**
 * For the future:
 * 1. It is impossible for active vehicles to become dormant,
 *    but it should be possible for dormant vehicles to become
 *    active should they start to return predictions. The move
 *    of dormant vehicles to active vehicles should already
 *    happen due to the flat map, however, those vehicles are
 *    currently not getting removed from the dormant vehicles.
 *
 */

import * as lambda from "aws-lambda"
import { winston } from "../utils/unicorns"

/* import utils */
import * as apiUtils from "../utils/api"
import * as listUtils from "../utils/lists"
import * as auditorUtils from "./utils"

/* import types */
import { Deps } from "../depency-injector"

export const auditor = (deps: Deps) => async (
  event?: lambda.APIGatewayEvent
) => {
  /* extract the dependencies */
  const { dynamodb, api, date } = deps

  /* --------------------- update the vehicle status item --------------------- */

  /* check dynamo for maps, stops, and vehicle status */
  const vehicleStatus = await dynamodb.getVehicleStatus()

  /* parse out the active and dormant statuses */
  const { statusOfVehicles } = vehicleStatus
  const {
    active: { allVehicleIds: _, ...active },
    dormant: { allVehicleIds: __, ...dormant },
  } = statusOfVehicles
  const activeVehicleEntries = Object.entries(active)
  const dormantVehicleEntries = Object.entries(dormant)

  /**
   * Flatten the active and dormant vehicle statuses and
   * keep them as a reference for their `predictionItemId`s.
   * */
  const activeFlatStatus = auditorUtils.flattenStatusItem(activeVehicleEntries)
  const dormantFlatStatus = auditorUtils.flattenStatusItem(
    dormantVehicleEntries
  )
  const flatVehicleStatus = { ...activeFlatStatus, ...dormantFlatStatus }

  /* determine the vids of the offline buses */
  const offlineVehicleIds = auditorUtils.getOfflineVehicleIds(
    flatVehicleStatus,
    { date }
  )

  /* batch the inactive vehicles into arrays of 10 */
  const chunkedVehicleIds = listUtils.chunk(offlineVehicleIds, 10)

  /* create an array of the api parameter objects for the api calls */
  const batchedVehicleIds = apiUtils.getApiParams(chunkedVehicleIds)

  /* make api calls for the vehicles that have gone offline */
  const vehicles = await Promise.all(batchedVehicleIds.map(api.getVehicles))
  const vehicleApiCount = vehicles.length

  /* check if any of those vehicles are now back online */
  const awakenedVehiclesId = auditorUtils.getAwakenedVehicleIds(vehicles)
  const activeVehicleStatus = auditorUtils.getVehicleStatusItem(
    awakenedVehiclesId,
    { flatVehicleStatus, initialVehicleStatus: active }
  )
  // TODO: just like scribe, this is wrong. Will add awakened vehicles to the dormant
  // const dormantVehicleStatus = auditorUtils.getVehicleStatusItem(
  //   awakenedVehiclesId,
  //   { flatVehicleStatus, initialVehicleStatus: dormant }
  // )
  // TODO: instead, add logic to go through the dormant flat status and if any
  // TODO: reawakened vehicles are there, remove them, THEN save to the status item

  const vehicleStatusItem = dynamodb.createItem({
    pk: "vehicle",
    sk: "status",
    active: activeVehicleStatus,
    dormant,
    // dormant: dormantVehicleStatus,
  })

  const saveVehicleStatus = dynamodb.writeItem(vehicleStatusItem)

  /* ------------------------------ vehicle stops ----------------------------- */

  const vehicleStops = await dynamodb.getVehicleStops()
  const vehicleStopsInDatabase = vehicleStops.length > 0
  const vehicleStopApiCount = !vehicleStopsInDatabase
    ? await auditorUtils.getVehicleStopApiCount(deps)
    : 0

  /* ------------------------------- map markers ------------------------------ */

  const mapMarkers = await dynamodb.getMapMarkers()
  const mapMarkersInDatabase = mapMarkers.length > 0
  const mapMarkerApiCount = !mapMarkersInDatabase
    ? await auditorUtils.getMapMarkerApiCount(deps)
    : 0

  /* ----------------------------- count api calls ---------------------------- */

  /* get the historical total number of api calls made */
  const previousApiTotal = await dynamodb.getApiCountTotal()
  const sessionApiCount =
    mapMarkerApiCount + vehicleStopApiCount + vehicleApiCount
  const apiCountTotal = Number(previousApiTotal) + sessionApiCount
  // const sessionApiStats = `Api Calls :: Maps: ${mapApiCount}. Stops: ${stopApiCount}. Vehicles: ${vehicleApiCount}.`
  // const totalApiStats = `Combined: ${apiCount}. Total: ${apiCountTotal}.`
  // winston.info(sessionApiStats)
  // winston.info(totalApiStats)
  const sessionApiCountItem = dynamodb.createHistoryItem({
    pk: "api_count_history",
    sk: date.getNowInISO(),
    calledBy: "auditor",
    sessionApiCount,
  })
  const totalApiCountItem = dynamodb.createItem({
    pk: "api_count",
    sk: "total",
    lastUpdatedBy: "auditor",
    lastUpdated: date.getNowInISO(),
    apiCountTotal,
  })

  /* ----------------------------- save everything ---------------------------- */

  const saveHistoryApiCount = dynamodb.writeHistoryItem(sessionApiCountItem)
  const saveSessionApiCount = dynamodb.writeItem(totalApiCountItem)
  await Promise.all([
    saveVehicleStatus,
    saveHistoryApiCount,
    saveSessionApiCount,
  ])
}
