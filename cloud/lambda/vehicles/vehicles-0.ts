import { winston } from "../utils/unicorns"

/* import types */
import { Deps, DateDep } from "../depency-injector"
import * as Misc from "../types/misc"
import * as Dynamo from "../services/dynamodb/types"

type Props = { predictionGroupId: number }

const getRecentVehicles = (vehicles: Dynamo.Vehicle[], { date }: DateDep) =>
  vehicles.filter(
    (vehicle) =>
      vehicle.predictions && date.elapsedMinsLessThan(vehicle.lastUpdateTime, 5)
  )

export const vehicles = (deps: Deps) => async (
  event?: Misc.AppsyncEvent<Props>
) => {
  const { dynamodb, date } = deps
  const { input } = event?.arguments ?? {}
  const { predictionGroupId } = input ?? {}
  const predictions = await dynamodb.getActivePredictions(predictionGroupId)

  if (!predictionGroupId) {
    return predictions.reduce<Dynamo.Vehicle[]>((store, prediction) => {
      const vehicles = Object.values(prediction.routes)
      const recentVehicles = getRecentVehicles(vehicles, { date })
      return [...store, ...recentVehicles]
    }, [])
  }

  // console.log("PREDICTION LENGTH: ", predictions.length)
  const [prediction] = predictions

  /* convert the large bus predictions object into an array */
  const vehicles = Object.values(prediction.routes)

  /* filter out buses that were last updated more than 5 minutes ago */
  return getRecentVehicles(vehicles, { date })
}
