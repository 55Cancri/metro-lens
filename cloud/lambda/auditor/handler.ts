import { auditor } from "./auditor-0"
import { injectDependencies } from "../depency-injector"

export const handler = injectDependencies(auditor)
