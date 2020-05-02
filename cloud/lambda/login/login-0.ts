/* login-0 is always the most recent version */
import * as aws from 'aws-sdk'
import * as lambda from 'aws-lambda'
// import * as R from 'ramda'
// import * as Rx from 'rxjs'
// import * as Op from 'rxjs/operators'

/* import services */
import { apiServiceProvider } from '../services/api'
import { dynamoServiceProvider } from '../services/dynamodb'
import { dateServiceProvider } from '../services/date'

/* import utils */
import * as objectUtils from '../utils/objects'
import * as arrayUtils from '../utils/arrays'
import * as UnicornUtils from '../utils/unicorns'

const { winston } = UnicornUtils

/* import types */
import * as Dynamo from '../types/dynamodb'
import * as Api from '../types/api'

/* ensure the dynamo table is in the correct region */
aws.config.update({ region: 'us-east-1' })

/* initialize the environment variables */
const MAX_DYNAMO_REQUESTS = 25

/* define error constants */
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`

/* setup dynamodb client */
const dynamodb = new aws.DynamoDB.DocumentClient()

/* define the handler */
export const handler = async (event?: lambda.APIGatewayEvent) => {
  winston.info('Start login.')

  winston.info('Received event:')
  winston.info({ event })

  return { id: 1, name: 'Jarvis' }
}
