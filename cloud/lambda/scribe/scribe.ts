import * as aws from 'aws-sdk'
import * as lambda from 'aws-lambda'
import axios from 'axios'
import * as R from 'ramda'
import * as Rx from 'rxjs'
import * as Op from 'rxjs/operators'
import { winston, print, is } from '../utils/unicorns'
import { buses } from '../mocks/buses'
import type { RequestOptions } from '../types'
import type { BusItem } from '../types/dynamodb'
import * as Api from '../types/api'
import * as arrayUtils from '../utils/arrays'
// import type {
//   ConnectorApiBusPredictions,
//   ConnectorApiBusPredictionsSuccess,
//   ConnectorApiBusPredictionsError,
// } from '../types/api'

aws.config.update({ region: 'us-east-1' })

winston.info(
  `localstack_hostname: ${process.env.LOCALSTACK_HOSTNAME}. aws_sam_local: ${process.env.AWS_SAM_LOCAL}`
)

type QueryParams = aws.DynamoDB.DocumentClient.QueryInput

type PutRequest = {
  PutRequest: {
    Item: BusItem
  }
}

/* environment variables */
const TABLE_NAME = process.env.TABLE_NAME || ''
const PRIMARY_KEY = process.env.PRIMARY_KEY || ''
const SORT_KEY = process.env.SORT_KEY || ''
const CONNECTOR_KEY = process.env.CONNECTOR_KEY || ''
const MAX_DYNAMO_REQUESTS = 25

/* define error constants */
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`

const urls = {
  cPredictions: 'https://www.fairfaxcounty.gov/bustime/api/v3/getpredictions',
  wPredictions: '',
}

/* setup dynamodb client */
const dynamodb = new aws.DynamoDB.DocumentClient({
  apiVersion: 'latest',
  region: 'us-east-1',
  // @ts-ignore
  endpoint:
    (process.env.AWS_SAM_LOCAL &&
      new aws.Endpoint('http://host.docker.internal')) ||
    undefined,
  // new aws.Endpoint('http://host.docker.internal:8000'),
  // new aws.Endpoint('http://docker.for.mac.localhost:8000'),
  // endpoint:
  //   process.env.AWS_SAM_LOCAL && new aws.Endpoint('http://localhost:8000'),
  // endpoint: process.env.AWS_SAM_LOCAL && 'https://localhost:8000:8000',
})

/**
 * Get the current time in ISO format.
 */
const getNowISO = () => new Date().toISOString()

/**
 * Make axios get request and return the results as an observable.
 * @param options
 */
const fromRequest = async (options: RequestOptions) => {
  // winston.info(`Sending request to ${options.url}.}.`)

  const { data } = (await axios.get(options.url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    params: options.params,
  })) as Api.ConnectorApiBase

  return data['bustime-response']
}

/**
 * Make dynamodb query and return the items as an observable.
 * @param params
 */
const fromQuery = (params: QueryParams) => {
  const dynamodbQuery = async () => {
    const { Items } = await dynamodb.query(params).promise()
    return <BusItem[]>Items
  }
  return Rx.from(dynamodbQuery())
}

const getNextCounter = (oldCounter: number) => oldCounter + 1

export const handler = async (event?: lambda.APIGatewayEvent) => {
  winston.info('Start.')

  /* make calls to get active buses from dynamodb */
  // const { Items } = await dynamodb
  //   .query({
  //     TableName: TABLE_NAME,
  //     KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skv)',
  //     ExpressionAttributeNames: { '#pk': PRIMARY_KEY, '#sk': SORT_KEY },
  //     ExpressionAttributeValues: { ':pk': 'bus', ':skv': 'status' },
  //   })
  //   .promise()

  // const activeBuses$ = fromQuery({
  //   TableName: TABLE_NAME,
  //   KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skv)',
  //   ExpressionAttributeNames: { '#pk': PRIMARY_KEY, '#sk': SORT_KEY },
  //   ExpressionAttributeValues: { ':pk': 'bus', ':skv': 'status' },
  // })

  /* get the vehicleIds of the active buses */
  const vehicleIds = buses.Items.reduce(
    (store, { vid, active }) => (active ? [...store, vid] : store),
    [] as number[]
  )

  const vehicleMap = buses.Items.reduce(
    (store, { vid, ...rest }) => ({ ...store, [vid]: rest }),
    {} as { [k: string]: BusItem }
  )

  /* batch the vehicles into groups of 10 */
  const chunkedVehicleIds = arrayUtils.chunk(vehicleIds, 10)
  //             params: {
  //               key: CONNECTOR_KEY,
  //               format: 'json',
  //               vid: vidList10.join(','),
  //             },
  /* convert the arrays into strings */
  const batchedVehicleIds: RequestOptions[] = chunkedVehicleIds.map(
    (vehicleIdArray) => ({
      url: urls.cPredictions,
      params: {
        key: CONNECTOR_KEY,
        format: 'json',
        vid: vehicleIdArray.join(','),
      },
    })
  )

  /* make an api call and extract the bustime-response */
  const makeApiCall = async (options: RequestOptions) => {
    const { data } = (await axios.get(options.url, {
      headers: { 'Content-Type': 'application/json' },
      params: options.params,
    })) as Api.ConnectorApiBase

    return data['bustime-response']
  }

  /* make the parallel api calls */
  const busResults = await Promise.all(batchedVehicleIds.map(makeApiCall))

  /* count the number of api calls made */
  const apiCount = busResults.length

  /* define a timestamp */
  const timestamp = getNowISO()

  /* define a type narrowing function */
  const isSuccessResponse = (
    response: Api.ConnectorResponse
  ): response is Api.ConnectorApiSuccess => {
    if ('msg' in response) return false
    return true
  }

  /* map an item to the format of a batch write request */
  const mapToRequest = (Item: BusItem) => ({ PutRequest: { Item } })

  /* process and map a bus response to a dynamodb item */
  const mapToItem = (response: Api.ConnectorResponse): BusItem => {
    const bus: BusItem = vehicleMap[response.vid]
    if (isSuccessResponse(response)) {
      const routes = bus.routes.includes(response.rt)
        ? bus.routes
        : [...bus.routes, response.rt]
      return { ...bus, active: true, lastChecked: timestamp, routes }
    }

    return { ...bus, active: false, lastChecked: timestamp }
  }

  /* convert bus responses to dynamodb items */
  const updatedBusItems = busResults.reduce((store, response) => {
    /* extract the pdr and err from the response  */
    const { prd, error } = response

    /* map the active buses to dynamodb items */
    const activeBuses =
      'prd' in response
        ? response.prd!.map(R.compose(mapToRequest, mapToItem))
        : []

    /* map the inactive buses to dynamodb items */
    const inactiveBuses =
      'error' in response
        ? response.error!.map(R.compose(mapToRequest, mapToItem))
        : []

    /* return the concatenated arrays  */
    return [...store, ...activeBuses, ...inactiveBuses]
  }, [] as PutRequest[])

  /* chunk the dynamodb items into arrays of 25 items */
  const chunkedBusItems = arrayUtils.chunk(updatedBusItems, 25)

  // winston.info(chunkedBusItems)
  winston.info({ apiCount })

  // const f = await Promise.all(chunkedBusItems.map(uploadToDynamo))

  // region
  /* get connector predictions */
  // fromRequest({
  //   url: urls.cPredictions,
  //   params: {
  //     key: process.env.CONNECTOR_KEY,
  //     format: 'json',
  //     stpid: '2101,6489,6345,2100,6486,1383,4011',
  //   },
  // })

  // type ConnectorApiBusPredictionKey = 'prd' | 'error'

  // type UpdateVehicles = {
  //   key: ConnectorApiBusPredictionKey
  //   value: unknown
  // }

  /* { key, value } */
  // const updateVehicles = (apiResponse: UpdateVehicles) =>
  //   Rx.of(apiResponse)
  //     .pipe(
  //       Op.tap(() => console.log('HELLO!!!!!!!')),
  //       Op.pluck('value'),
  //       Op.concatMap((response) =>
  //         Rx.of(response).pipe(
  //           Op.pluck(apiResponse.key),
  //           Op.tap((v) => console.log({ v }))
  //         )
  //       )
  //     )
  //     .subscribe()
  // endregion

  // return activeBuses$
  // return Rx.from(buses)
  //   .pipe(
  //     /* take only 10 bus items at a time */
  //     Op.bufferCount(10),
  //     Op.concatMap((busList10) =>
  //       /* emit each bus from the list one at a time */
  //       Rx.from(busList10).pipe(
  //         /* transform each bus observable into just the vid */
  //         Op.pluck('vid'),
  //         /* then aggregate the buses back into arrays of 10 */
  //         Op.bufferCount(10),
  //         /* map the array of vids into a request object with concatenated vids */
  //         Op.map((vidList10) => {
  //           return <RequestOptions>{
  //             url: urls.cPredictions,
  //             params: {
  //               key: CONNECTOR_KEY,
  //               format: 'json',
  //               vid: vidList10.join(','),
  //             },
  //           }
  //         }),
  //         /* use mergemap to handle async http call */
  //         Op.mergeMap(fromRequest),
  //         /* increment api counter */
  //         Op.tap(() => apiCounter$.next(1)),
  //         Op.map((response) => {
  //           /* extract the pdr and err from the response    */
  //           if (
  //             is<Api.ConnectorApiBusPredictionsSuccess>(
  //               response,
  //               'prd' in response
  //             )
  //           ) {
  //             response.prd.map((item) => {})
  //           }
  //           if (
  //             is<Api.ConnectorApiBusPredictionsError>(
  //               response,
  //               'error' in response
  //             )
  //           ) {
  //             response.error.map((item) => {})
  //           }
  //           // return updateVehicles({ key, value })
  //         })
  //       )
  //     )
  //   )
  //   .toPromise()

  /* wmata buses */
  // const wmata = await axios.get(
  //   'https://api.wmata.com/NextBusService.svc/json/jPredictions',
  //   {
  //     headers: { api_key: process.env.WMATA_KEY },
  //     params: { StopID: '5001306' },
  //   }
  // )

  // console.log(wmata.data)
  // console.log(connector.data)
}
