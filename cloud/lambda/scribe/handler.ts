import axios from "axios"
import * as aws from "aws-sdk"
import { scribe } from "./scribe-0"
import { apiServiceProvider } from "../services/api-0"
import { dynamoServiceProvider } from "../services/dynamodb-0"
import { dateServiceProvider } from "../services/date"

/* ensure the dynamo table is in the correct region */
aws.config.update({ region: "us-east-1" })

/* setup dynamodb client */
const client = new aws.DynamoDB.DocumentClient()

/* initialize services */
const date = dateServiceProvider()
const api = apiServiceProvider({ httpClient: axios })
const dynamodb = dynamoServiceProvider({ dynamodb: client, date })

export type Deps = {
  date: typeof date
  api: typeof api
  dynamodb: typeof dynamodb
}

/* export the handler with dependencies injected */
export const handler = scribe({ date, api, dynamodb })
