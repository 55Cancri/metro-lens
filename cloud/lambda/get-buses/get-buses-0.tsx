import * as aws from 'aws-sdk'

import { dynamoServiceProvider } from '../services/dynamodb'
import { dateServiceProvider } from '../services/date'

/* ensure the dynamo table is in the correct region */
aws.config.update({ region: 'us-east-1' })

/* define error constants */
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`

/* setup dynamodb client */
const dynamodb = new aws.DynamoDB.DocumentClient()

/* define the handler */
export const handler = async (event?: Misc.AppsyncEvent<Iam.ClientLogin>) => {
  /* // TODO: initialize services in separate file */
  const dateService = dateServiceProvider()

  const dynamoService = dynamoServiceProvider({ dynamodb, dateService })

  /* query for active buses */
  const activeBusPromise = dynamoService.getStatusOfBuses()

  /* query for predictions */
  const busPredictionPromise = dynamoService.getBusPredictions()

  const [activeBuses, busPredictions] = await Promise.all([
    activeBusPromise,
    busPredictionPromise,
  ])

  /* use active buses to get predictions */

  return {}
}
