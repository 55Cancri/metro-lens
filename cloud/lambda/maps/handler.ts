import { maps } from "./map-0"
import { injectDependencies } from "../depency-injector"

export const handler = injectDependencies(maps)
