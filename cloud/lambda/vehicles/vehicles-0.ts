import { winston } from "../utils/unicorns"

/* import types */
import { Deps } from "../depency-injector"
import * as Misc from "../types/misc"

type Props = { predictionGroupId: number }

export const vehicles = (deps: Deps) => async (
  event?: Misc.AppsyncEvent<Props>
) => {
  const { dynamodb, date } = deps
  const { predictionGroupId } = event?.arguments.input!
  const predictions = await dynamodb.getActivePredictions(predictionGroupId)

  console.log("PREDICTION LENGTH: ", predictions.length)
  const [prediction] = predictions

  /* convert the large bus predictions object into an array */
  const vehicles = Object.values(prediction.routes)

  /* filter out buses that were last updated more than 5 minutes ago */
  const recentVehicles = vehicles.filter(
    (vehicle) =>
      vehicle.predictions && date.elapsedMinsLessThan(vehicle.lastUpdateTime, 5)
  )
  return recentVehicles
}
