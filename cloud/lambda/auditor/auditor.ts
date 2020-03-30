import * as aws from 'aws-sdk'
import * as lambda from 'aws-lambda'
import now from 'performance-now'
import time from 'date-fns'
import axios from 'axios'
import util from 'util'

type Route = {
  rt: string
  rtnm: string
}

type VehicleApi = {
  vid: string
}

type Vehicle = {
  entity: string
  id: string
  rt: string
  vid: string
  routes: string[]
  active: boolean
  lastChecked: string
  dateCreated: string
}

type RouteObject = Pick<Vehicle, 'active' | 'lastChecked'>

type RouteMap = { [k: string]: RouteObject }

type QueryParams = aws.DynamoDB.DocumentClient.QueryInput

export class StopWatch {
  startTime = 0
  stopTime = 0
  running = false
  now = now

  currentTime = () => (this.now ? this.now() : new Date().getTime())

  start = () => {
    this.startTime = this.currentTime()
    this.running = true
  }

  stop = () => {
    this.stopTime = this.currentTime()
    this.running = false
  }

  getElapsedMilliseconds = () => {
    if (this.running) {
      this.stopTime = this.currentTime()
    }

    return this.stopTime - this.startTime
  }

  logElapsedMilliseconds = () => {
    if (this.running) {
      this.stopTime = this.currentTime()
    }

    const elapsedMilliseconds = this.stopTime - this.startTime

    console.log('Elapsed time (ms): ' + elapsedMilliseconds)
  }

  getElapsedSeconds = () => this.getElapsedMilliseconds() / 1000

  logElapsedSeconds = () => {
    const elapsedSeconds = this.getElapsedMilliseconds() / 1000
    console.log('Elapsed time (s): ' + elapsedSeconds.toFixed(1))
  }
}

/* setup dynamodb client */
const client = new aws.DynamoDB.DocumentClient()

/* define dynamodb constants */
const TABLE_NAME = process.env.TABLE_NAME || ''
const PRIMARY_KEY = process.env.PRIMARY_KEY || ''
const SORT_KEY = process.env.SORT_KEY || ''
const KEY = process.env.CONNECTOR_KEY || ''

/* define error constants */
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`

const trace = (item: unknown) =>
  console.log(util.inspect(item, false, null, true))

/**
 * Print the entire contents to the lambda logs.
 *
 * @param item
 */
const lambdaLog = (item: unknown) => console.log(JSON.stringify(item, null, 2))

const getNowISO = () => new Date().toISOString()

/**
 * Determine if a route should be checked by making sure it is not active
 * and the last check was over 12 hours ago.
 *
 * @param routeObject routeObject - the data of a specific route in dynamodb
 */
const shouldCheckRoute = (routeObject: RouteObject) => {
  const hoursSinceLastCheck = time.differenceInHours(
    new Date(),
    new Date(Number(routeObject.lastChecked))
  )

  return !routeObject.active && hoursSinceLastCheck > 12
}

/* lambda */
export const handler = async (event?: lambda.APIGatewayEvent): Promise<any> => {
  const stopwatch = new StopWatch()

  stopwatch.start()

  /* query by route + status_ */
  const routeStatusParams: QueryParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skv)',
    ExpressionAttributeNames: { '#pk': PRIMARY_KEY, '#sk': SORT_KEY },
    ExpressionAttributeValues: { ':pk': 'route', ':skv': 'status' },
  }

  /* query by bus + metadata_ */
  const metadataParams: QueryParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skv)',
    ExpressionAttributeNames: { '#pk': PRIMARY_KEY, '#sk': SORT_KEY },
    ExpressionAttributeValues: { ':pk': 'bus', ':skv': 'metadata' },
  }

  /* define the default params */
  const defaultParams = { key: KEY, format: 'json' }

  // let vehicleCount = 0

  /* get the stored status of the routes */
  const { Items: storedRouteStatus } = await client
    .query(routeStatusParams)
    .promise()

  /* map the array into a map for comparison with the api response */
  const routeStatusMap = storedRouteStatus?.reduce(
    (store, { route, active, lastChecked }) => ({
      ...store,
      [route]: { active, lastChecked },
    }),
    {}
  ) as RouteMap

  /* make the getroutes api call */
  const {
    data,
  } = await axios.get(
    'https://www.fairfaxcounty.gov/bustime/api/v3/getroutes',
    { params: defaultParams }
  )

  /* extract the array of routes from the api response */
  const { routes } = data['bustime-response']

  /* // TODO: start counting the number of api requests */
  const callCount = 1

  /**
   * PT 1: update the route information.
   *
   * For each route, get the associated vehicles.
   * @param {Route} route - information about the route
   * @returns {Route[]}
   */
  const getVehicles = async ({ rt, rtnm }: Route) => {
    /* check if the route status already exists in dynamodb */
    const routeInMap: RouteObject = routeStatusMap[rt]

    /* if an api call should be made for this route, */
    if (!routeInMap || shouldCheckRoute(routeInMap)) {
      /* then get the vehicles based on that rt parameter */
      const {
        data: response,
      } = await axios.get(
        'https://www.fairfaxcounty.gov/bustime/api/v3/getvehicles',
        { params: { ...defaultParams, rt } }
      )

      /* extract the fresh route date from the api response */
      const routeData = response['bustime-response']

      /* mark a timestamp */
      const now = getNowISO()

      /* update the last check time for the route */
      const lastChecked = now

      /* define the date created for this record if it doesn't exist already */
      const dateCreated = !routeInMap ? { dateCreated: now } : {}

      /* if the call returned vehicle data as a successful response, */
      if ('vehicle' in routeData) {
        /* extract the vehicle information */
        const { vehicle } = routeData as { vehicle: VehicleApi[] }

        /* update or create a new record for the route in dynamodb */
        const saveRouteStatus = client
          .put({
            TableName: TABLE_NAME,
            Item: {
              [PRIMARY_KEY]: 'route',
              [SORT_KEY]: `status_${rt}`,
              route: rt,
              active: true,
              lastChecked,
              ...dateCreated,
            },
          })
          .promise()

        /* then map through the vehicle array and create param objects */
        const vehicles = vehicle.map(({ vid }) => {
          /* define the dynamodb sort key */
          const id = `metadata_${vid}`

          /* this object will create or update the vehicle record in dynamodb */
          return {
            [PRIMARY_KEY]: 'bus',
            [SORT_KEY]: id,
            lastCheck: lastChecked,
            dateCreated: now,
            active: true,
            vid,
            rt,
          }
        })

        /* finish waiting for the updated route data to save in dynamodb */
        await saveRouteStatus

        /* return the params object to the map */
        return vehicles
      }

      /* otherwise if an error returned, */
      if ('error' in routeData) {
        /* create or update the inactive and lastCheck time for the route */
        const saveRouteStatus = client
          .put({
            TableName: TABLE_NAME,
            Item: {
              [PRIMARY_KEY]: 'route',
              [SORT_KEY]: `status_${rt}`,
              route: rt,
              active: false,
              lastChecked,
              ...dateCreated,
            },
          })
          .promise()

        /* extract the error array */
        const { error } = routeData

        /* extract the error object from the error array */
        const [item] = error

        /* extract error string from the error object */
        const { msg } = item

        /* log the error to the cloudwatch logs */
        console.log('Error occurred for route: ' + rt)

        /* wait for the route update to finish saving */
        await saveRouteStatus

        /* // TODO: not sure why this is needed anymore */
        return [{ rt, active: false, lastCheck: lastChecked }]
      }
    }

    return []
  }

  // /* get the current vehicle ids */
  // const { Items } = await client.query(metadataParams).promise()

  // /* get the vehicle ids for every route */
  // const allVehicles = await Promise.all(routes.map(getVehicles))

  /* get the current vehicle ids */
  const query = client.query(metadataParams).promise()

  /* get the vehicle ids for every route and flatten the nested arrays */
  const api = Promise.all(routes.flatMap(getVehicles)) as Promise<Vehicle[][]>

  /**
   * PT 2: update the vehicle ids in dynamodb.
   *
   * Wait for the api calls to dynamodb and the bus api to finish in parallel.
   * The `Promise.all` creates a 2d array of the api call.
   */
  const [storedVehicles, apiVehicles] = await Promise.all([query, api])

  /* extract the stored vehicle ids from the dynamodb call */
  const { Items } = storedVehicles

  /* flatten the 2d array returned from the the api call */
  const flatVehicles = apiVehicles.flat()

  /* store the saved dynamodb vehicles in a map */
  const vehicleMapDb = Items?.reduce((store, { id, ...rest }) => {
    /* get the vehicleId - metadata_401 -> ['metadata', '401'] */
    const [, vehicleId] = id.split('-')

    /* assign the vehicle data object to the vehicle id key */
    return { ...store, [vehicleId]: rest }
  }, {}) as { [key: string]: Vehicle }

  /* log data */
  // console.log('Flat Vehicles')
  // lambdaLog(flatVehicles.slice(0, 3))

  // console.log('Stored Vehicle Map')
  // lambdaLog(vehicleMapDb)

  /**
   * Update the vehicles based on the api result.
   *
   * This array of updated vehicles will only update the status of each
   * vehicle e.g. active and routes, not the locations and arrival times,
   * which is handled by the other more frequent lambda.
   */
  const updatedVehicleItems = flatVehicles.reduce((store, vehicle) => {
    /* Check if the vehicleIds returned from the api call exist in dynamodb */
    const inVehicleMap = vehicleMapDb[vehicle.vid]

    /* define a common partition key */
    const partitionKey = {
      [PRIMARY_KEY]: 'bus',
      [SORT_KEY]: `status_${vehicle.vid}`,
    }

    /* create timestamps */
    const now = getNowISO()

    /* define the date created for the vehicles not in dynamodb */
    const dateCreated = now

    /* update the last checked for every vehicle */
    const lastChecked = now

    /* if the vehicleId does not exist in dynamodb, */
    if (!inVehicleMap) {
      /* create a new vehicle entry */
      const routes = [vehicle.rt]

      /* and add it to the `newVehicles` array */
      return [
        ...store,
        { ...vehicle, ...partitionKey, routes, dateCreated, lastChecked },
      ]
    }

    /**
     * otherwise check if the existing dynamodb vehicleId record
     * has encountered this vehicle on this route before.
     */

    const { routes } = inVehicleMap

    /* if the vehicleId dynamodb record has not encountered this route before, */
    if (!routes.includes(vehicle.rt)) {
      /* then add the new route to the item */
      const updatedRoutes = [...routes, vehicle.rt]

      /* and return the `newVehicles` array with the updated routes array */
      return [
        ...store,
        {
          ...inVehicleMap,
          ...partitionKey,
          routes: updatedRoutes,
          lastChecked,
        },
      ]
    }

    /**
     * otherwise, the record is fully accounted for in the table,
     * so just update last checked
     */
    return [...store, { ...inVehicleMap, ...partitionKey, lastChecked }]
  }, [] as Vehicle[])

  /* batch write the vehicleIdItems to dynamodb */
  console.log('Updated vehicle status')
  lambdaLog(updatedVehicleItems)

  stopwatch.stop()

  stopwatch.logElapsedSeconds()

  /* define item */
  const item = { [PRIMARY_KEY]: 'testing', id: getNowISO() }

  /* define params */
  const putParams = { TableName: TABLE_NAME, Item: item }

  try {
    /* add item to dynamodb table */
    await client.put(putParams).promise()

    /* return success response */
    return { statusCode: 201, body: '' }
  } catch (error) {
    console.error(error)

    /* determine error message */
    const errorResponse =
      error.code === 'ValidationException' &&
      error.message.includes('reserved keyword')
        ? RESERVED_RESPONSE
        : DYNAMODB_EXECUTION_ERROR

    /* return error response */
    return { statusCode: 500, body: errorResponse }
  }
}
