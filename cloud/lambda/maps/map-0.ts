import { winston } from "../utils/unicorns"

/* import types */
import { Deps } from "../depency-injector"
import * as Misc from "../types/misc"
// import * as Dynamo from "../services/dynamodb/types"

type Props = { route: string; direction: string }

/**
 * Get all of the stops and waypoints for a specific route.
 * @param deps
 */
export const maps = (deps: Deps) => async (
  event?: Misc.AppsyncEvent<Props>
) => {
  const { dynamodb } = deps
  const { input } = event?.arguments ?? {}
  const { route, direction } = input ?? {}
  const [item] = await dynamodb.getMap(route!, direction!)
  return item.map
}
