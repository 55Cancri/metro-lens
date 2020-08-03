import * as Dynamo from "../../services/dynamodb/types"
import * as objectUtils from "../../utils/objects"
import * as listUtils from "../../utils/lists"

import { Deps, DateDep } from "../../depency-injector"

const ACTIVE_PREDICTION_SET_SIZE = process.env.ACTIVE_PREDICTION_SET_SIZE
  ? Number(process.env.ACTIVE_PREDICTION_SET_SIZE)
  : 25

type ApiParams = { readonly key: string; readonly format: "json" }

/**
 * Sort on vehicleId.
 * @param a
 * @param b
 */
const onVehicleId = (a: Dynamo.VehicleStatus, b: Dynamo.VehicleStatus) =>
  Number(a.vehicleId) - Number(b.vehicleId)

/**
 * Reduce an list of predictionId->vehicleId->vehicleStatus
 * objects into a list of just vehicleStatus objects.
 * @param predictionStatusItems
 */
const getStatusOfVehicles = (
  predictionStatusItems: Dynamo.PredictionStatus[]
) =>
  predictionStatusItems.reduce(
    (store, statusGroup) => store.concat(Object.values(statusGroup)),
    [] as Dynamo.VehicleStatus[]
  ) as Dynamo.VehicleStatus[]

/**
 * Redistribute a list of vehicleStatus objects into an object with
 * an active->vehicleStatus list and dormant->vehicleStatus list.
 * @param statusOfVehicles
 * @param param1
 */
const distributeStatusOfVehicles = (
  statusOfVehicles: Dynamo.VehicleStatus[],
  { date }: DateDep
) =>
  statusOfVehicles.reduce(
    (store, vehicleStatus, i, array) => {
      const isLastItem = i === array.length - 1
      const vehicleUpdated3DaysAgo = date.elapsedDaysGreaterThan(
        vehicleStatus?.wentOffline,
        3
      )
      const dormant = !isLastItem
        ? store.dormant.concat([vehicleStatus])
        : store.dormant.concat([vehicleStatus]).sort(onVehicleId)
      const active = !isLastItem
        ? store.active.concat([vehicleStatus])
        : store.active.concat([vehicleStatus]).sort(onVehicleId)
      return vehicleUpdated3DaysAgo
        ? { ...store, dormant }
        : { ...store, active }
    },
    { active: [], dormant: [] } as {
      active: Dynamo.VehicleStatus[]
      dormant: Dynamo.VehicleStatus[]
    }
  )

/**
 * Convert a list of vehicleStatuses into an object of
 * predictionId->vehicleId->vehicleStatus objects
 * @param chunkedStatusOfVehicles
 */
const reassembleStatusObject = (
  chunkedStatusOfVehicles: Dynamo.VehicleStatus[][],
  { date }: DateDep
) =>
  chunkedStatusOfVehicles.reduce((store, vehicleStatusChunk, i) => {
    const predictionItemId = i + 1
    const everyVehicleStatus = vehicleStatusChunk.reduce(
      (innerStore, vehicleStatus) => ({
        ...innerStore,
        [vehicleStatus.vehicleId]: vehicleStatus,
      }),
      {} as Dynamo.PredictionStatus
    )
    return { ...store, [predictionItemId]: everyVehicleStatus }
  }, {} as Dynamo.Status)

const createStatusItem = (
  previousActive: Dynamo.Status,
  previousDormant: Dynamo.Status,
  { date }: DateDep
) => {
  const activePredictionItems = Object.values(previousActive)
  const dormantPredictionItems = Object.values(previousDormant)
  const predictionItems = activePredictionItems.concat(dormantPredictionItems)
  const statusOfVehicles = getStatusOfVehicles(predictionItems)
  const status = distributeStatusOfVehicles(statusOfVehicles, { date })

  const chunkedActiveVehicles = listUtils.chunk(
    status.active,
    ACTIVE_PREDICTION_SET_SIZE
  )
  const chunkedDormantVehicles = listUtils.chunk(
    status.dormant,
    ACTIVE_PREDICTION_SET_SIZE
  )

  const active = reassembleStatusObject(chunkedActiveVehicles, { date })
  const dormant = reassembleStatusObject(chunkedDormantVehicles, { date })
  return { active, dormant }
}

/**
 * Redistribute vehicle's between active and dormant
 * buckets.
 * @param previousVehicleStatusItem
 * @param param1
 */
export const reorganizeVehicleStatus = async (
  previousVehicleStatusItem: Dynamo.VehicleStatusItem,
  { dynamodb, date, api, params }: Deps & { params: ApiParams }
) => {
  const statusItemIsEmpty = objectUtils.objectIsEmpty(previousVehicleStatusItem)

  // always query every vehicle if the status is empty
  if (statusItemIsEmpty) {
    return api.getActiveVehicles(params)
  }

  const vehicleScannerItem = await dynamodb.getVehicleScannerTime()
  const { nextExecutionTime } = vehicleScannerItem
  const executionTimeIsNow = date.isWithinWindow(nextExecutionTime)

  if (executionTimeIsNow) {
    const apiResult = await api.getActiveVehicles(params)
    const { statusOfVehicles, routeApiCount } = apiResult
    const { dormant } = previousVehicleStatusItem
    const { active } = statusOfVehicles
    const updatedStatusOfVehicles = createStatusItem(active, dormant, { date })
    const mergedStatusOfVehicles = {
      ...statusOfVehicles,
      ...updatedStatusOfVehicles,
    }

    // update vehicle scanner item
    const updatedVehicleScannerItem = {
      ...vehicleScannerItem,
      nextExecutionTime: date.getRandomTime(date.setToNextDay()),
    }
    await dynamodb.writeItem(updatedVehicleScannerItem)
    return { statusOfVehicles: mergedStatusOfVehicles, routeApiCount }
  }
  const { active, dormant } = previousVehicleStatusItem
  const updatedStatusOfVehicles = createStatusItem(active, dormant, { date })
  const mergedStatusOfVehicles = {
    ...previousVehicleStatusItem,
    ...updatedStatusOfVehicles,
  }
  return { statusOfVehicles: mergedStatusOfVehicles, routeApiCount: 0 }
}
