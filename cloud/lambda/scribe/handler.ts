import { scribe } from "./scribe-0"
import { injectDependencies } from "../depency-injector"

export const handler = injectDependencies(scribe)
