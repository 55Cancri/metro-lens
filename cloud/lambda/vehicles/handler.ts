import { vehicles } from "./vehicles-0"
import { injectDependencies } from "../depency-injector"

export const handler = injectDependencies(vehicles)
