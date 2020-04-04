import * as aws from 'aws-sdk'
import * as lambda from 'aws-lambda'
import axios from 'axios'
import rx from 'rxjs'
import op from 'rxjs/operators'
import logger from 'winston'

type Options = {
  url: string
  headers?: {
    api_key?: string
  }
  params?: {
    key?: string
    format?: 'json'
    stpid?: string
    StopID?: string
  }
}

type QueryParams = aws.DynamoDB.DocumentClient.QueryInput

/* environment variables */
const TABLE_NAME = process.env.TABLE_NAME || ''
const PRIMARY_KEY = process.env.PRIMARY_KEY || ''
const SORT_KEY = process.env.SORT_KEY || ''
const KEY = process.env.CONNECTOR_KEY || ''
const MAX_DYNAMO_REQUESTS = 25

/* define error constants */
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`

const urls = {
  cPredictions: 'https://www.fairfaxcounty.gov/bustime/api/v3/getpredictions',
  wPredictions: '',
}

const winston = logger.createLogger({
  level: 'info',
})

/* setup dynamodb client */
const dynamodb = new aws.DynamoDB.DocumentClient()

/**
 * Print the entire contents to the lambda logs.
 *
 * @param item
 */
const lambdaLog = (item: unknown) => console.log(JSON.stringify(item, null, 2))

/**
 * Get the current time in ISO format.
 */
const getNowISO = () => new Date().toISOString()

/**
 * Make axios get request and return the results as an observable.
 * @param options
 */
const fromRequest = (options: Options) => {
  const axiosRequest = async () => {
    const { data } = await axios.get(options.url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      params: options.params,
    })

    return data
  }

  return rx.from(axiosRequest())
}

/**
 * Make dynamodb query and return the items as an observable.
 * @param params
 */
const fromQuery = (params: QueryParams) => {
  const dynamodbQuery = async () => {
    const { Items } = await dynamodb.query(params).promise()
    return Items
  }
  return rx.from(dynamodbQuery())
}

export const handler = async (
  event?: lambda.APIGatewayEvent
): Promise<any[]> => {
  /* count the number of api calls */
  const apiCounter = new rx.BehaviorSubject(0).pipe(
    op.scan((store, hit) => store + 1, 0)
  )

  fromQuery({
    TableName: TABLE_NAME,
    KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skv)',
    ExpressionAttributeNames: { '#pk': PRIMARY_KEY, '#sk': SORT_KEY },
    ExpressionAttributeValues: { ':pk': 'route', ':skv': 'status' },
  })

  /* get connector predictions */
  fromRequest({
    url: urls.cPredictions,
    params: {
      key: process.env.CONNECTOR_KEY,
      format: 'json',
      stpid: '2101,6489,6345,2100,6486,1383,4011',
    },
  }).pipe()

  winston.info('Hi there.')

  /* wmata buses */
  // const wmata = await axios.get(
  //   'https://api.wmata.com/NextBusService.svc/json/jPredictions',
  //   {
  //     headers: { api_key: process.env.WMATA_KEY },
  //     params: { StopID: '5001306' },
  //   }
  // )

  console.log(`[${new Date().toLocaleString()}]: Hello World!`)
  // console.log(wmata.data)
  // console.log(connector.data)
  const response = JSON.stringify(event, null, 2)
  // return response
  return [{ id: '1', name: 'oneone' }]
}
