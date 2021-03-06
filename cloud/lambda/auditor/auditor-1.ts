import * as aws from 'aws-sdk'
import * as time from 'date-fns'
import * as lambda from 'aws-lambda'
import asyncPool from 'tiny-async-pool'
import now from 'performance-now'
import axios from 'axios'
import util from 'util'

/* sam invocation is liable to fail without this update */
aws.config.update({ region: 'us-east-1' })

/* define dynamodb constants */
const TABLE_NAME = process.env.TABLE_NAME || ''
const PARTITION_KEY = process.env.PARTITION_KEY || ''
const SORT_KEY = process.env.SORT_KEY || ''
const KEY = process.env.CONNECTOR_KEY || ''
const MAX_DYNAMO_REQUESTS = 25

/* define error constants */
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`

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
  vehicleId: string
  routes: string[]
  active: boolean
  lastChecked: string
  dateCreated: string
}

type Pt = {
  seq: number
  lat: number
  lon: number
  typ: 'S' | 'W'
  stpid: string
  stpnm: string
  pdist: number
}

type RouteDirection = 'North' | 'South' | 'East' | 'West'

type Pattern = {
  pid: number
  ln: number
  rtdir: RouteDirection
  pt: Pt[]
}

// type PartitionKey = {
//   [PARTITION_KEY: string]: 'bus' | 'route' | 'user' | 'metadata'
// }

// type SortKey = { [key: string]: string }

// type RoutePatternItem = PartitionKey & SortKey & {
type RoutePatternItem = {
  // [key: string]: string
  routeDirection: RouteDirection
  stopName: string
  stopId: string
  sequence: number
  lat: number
  lon: number
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
const dynamodb = new aws.DynamoDB.DocumentClient()

const trace = (item: unknown) =>
  console.log(util.inspect(item, false, null, true))

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

  return !routeObject.active || hoursSinceLastCheck > 12
}

/**
 * Upload the items to dynamodb in bulk.
 */
const batchPutItems = async (requests: unknown[]) => {
  /* define the params of the dynamoDB call */
  const params = {
    RequestItems: { [TABLE_NAME]: requests },
  } as aws.DynamoDB.DocumentClient.BatchWriteItemInput

  /* call the batch write to save the items to the table */
  return dynamodb.batchWrite(params).promise()
}

/**
 * Chunk an array into smaller arrays.
 */
const chunk = (arr: unknown[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  )

const packageAndShip = async (items: unknown[]) => {
  const payload = items.map((Item) => ({ PutRequest: { Item } }))

  // /* chunk the the payloads, */
  const requests = chunk(payload, MAX_DYNAMO_REQUESTS)

  /**
   * Then batch save all the items to dynamoDB,
   * one chunk at a time.
   */
  return Promise.all(requests.map(batchPutItems))
}

/**
 * The goal of this lambda is simple — to update the status of every route
 * and the status of every vehicle of the *active* routes.
 *
 * Updating the status of the routes and the vehicles mostly involves
 * setting the active property to true or false.
 *
 * For the route updates, it will update the lastChecked property
 * every 12 hours, even though the lambda will run every hour.
 *
 * @param event
 */
export const handler = async (event?: lambda.APIGatewayEvent): Promise<any> => {
  const stopwatch = new StopWatch()

  stopwatch.start()

  /* query by route + status_ */
  const routeStatusParams: QueryParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skv)',
    ExpressionAttributeNames: { '#pk': PARTITION_KEY, '#sk': SORT_KEY },
    ExpressionAttributeValues: { ':pk': 'route', ':skv': 'status' },
  }

  /* query by route + map_ */
  /* should only be called once to get stop values */
  const routeLaneParams = (routeId: string): QueryParams => ({
    TableName: TABLE_NAME,
    KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skv)',
    ExpressionAttributeNames: { '#pk': PARTITION_KEY, '#sk': SORT_KEY },
    ExpressionAttributeValues: { ':pk': 'route', ':skv': `map_${routeId}` },
    Limit: 1,
  })

  /* query by bus + metadata_ */
  // !I dont think this is needed anymore
  const metadataParams: QueryParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skv)',
    ExpressionAttributeNames: { '#pk': PARTITION_KEY, '#sk': SORT_KEY },
    ExpressionAttributeValues: { ':pk': 'bus', ':skv': 'metadata' },
  }
  /* query by api_counter + total */
  const apiCounterParams: QueryParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: '#pk = :pk AND #sk = :sk',
    ExpressionAttributeNames: { '#pk': PARTITION_KEY, '#sk': SORT_KEY },
    ExpressionAttributeValues: { ':pk': 'api_counter', ':sk': 'total' },
  }

  /* define the default params */
  const defaultParams = { key: KEY, format: 'json' }

  // let vehicleCount = 0

  /* get the stored status of the routes */
  const { Items: routeStatusDb } = await dynamodb
    .query(routeStatusParams)
    .promise()

  /* get the current vehicle ids */
  const { Items: vehicleStatusDb } = await dynamodb
    .query(metadataParams)
    .promise()

  /* get the total api counts */
  const { Items: apiCountTotal } = await dynamodb
    .query(apiCounterParams)
    .promise()

  /* map the array into a map for comparison with the api response */
  const routeStatusMap = <RouteMap>routeStatusDb?.reduce(
    (store, { route, active, lastChecked }) => ({
      ...store,
      [route]: { active, lastChecked },
    }),
    {}
  )

  /* store the saved dynamodb vehicles in a map */
  const vehicleMapDb = vehicleStatusDb?.reduce((store, { id, ...rest }) => {
    /* get the vehicleId - metadata_401 -> ['status', '401'] */
    const [, vehicleId] = id.split('-')

    /* assign the vehicle data object to the vehicle id key */
    return { ...store, [vehicleId]: rest }
  }, {}) as { [key: string]: Vehicle }

  /* make the getroutes api call */
  const {
    data,
  } = await axios.get(
    'https://www.fairfaxcounty.gov/bustime/api/v3/getroutes',
    { params: defaultParams }
  )

  /* extract the array of routes from the api response */
  const { routes } = data['bustime-response']

  const initialApiCount = 1

  /**
   * PT 1: update the route information.
   * The route call is made, then for each route in the
   * array, the getVehicles function is called.
   *
   * For each route, get the associated vehicles.
   * @param {Route} route - information about the route
   * @returns {Route[]}
   */
  const getVehiclesAndUpdateRoute = async ({ rt, rtnm }: Route) => {
    /* check if the route status already exists in dynamodb */
    const routeInMap: RouteObject = routeStatusMap[rt]

    /* will only call vehicle api if route is inactive */
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
      const routeDateCreated = !routeInMap ? { dateCreated: now } : {}

      /* if the call returned vehicle data as a successful response, */
      if ('vehicle' in routeData) {
        /* extract the vehicle information */
        const { vehicle } = <{ vehicle: VehicleApi[] }>routeData

        /* update or create a new record for the route in dynamodb */
        const saveRouteStatus = dynamodb
          .put({
            TableName: TABLE_NAME,
            Item: {
              [PARTITION_KEY]: 'route',
              [SORT_KEY]: `status_${rt}`,
              route: rt,
              active: true,
              lastChecked,
              ...routeDateCreated,
            },
          })
          .promise()

        const getRoutes = (vehicleInMap: Vehicle, route: string) => {
          /* step 1: 3 step process to add rt to the routes of the vehicle */
          const existingVehicleRoutes = vehicleInMap ? vehicleInMap.routes : []

          if (existingVehicleRoutes.length > 0) {
            if (!existingVehicleRoutes.includes(route)) {
              return [...existingVehicleRoutes, route]
            }

            return existingVehicleRoutes
          }

          return [route]
        }

        /* then map through the vehicle array and create param objects */
        const vehicles = vehicle.map(({ vid: vehicleId, ...rest }) => {
          /* define the dynamodb sort key */
          const id = `status_${vehicleId}`

          const vehicleInMap = vehicleMapDb[vehicleId]

          /* define the date created for this record if it doesn't exist already */
          const vehicleDateCreated = !vehicleInMap ? { dateCreated: now } : {}

          const routes = getRoutes(vehicleInMap, rt)

          /* this object will create or update the vehicle record in dynamodb */
          return {
            ...vehicleInMap,
            [PARTITION_KEY]: 'bus',
            [SORT_KEY]: id,
            active: true,
            lastChecked,
            vehicleId,
            routes,
            ...vehicleDateCreated,
          }
        })

        /* finish waiting for the updated route data to save in dynamodb */
        await saveRouteStatus

        /* return the params object to the map */
        /* for each api call, return a variable count with the number 1 */
        /* later on, all the count variables will be aggregated */
        return { vehicles, count: 1 }
      }

      /* otherwise if an error returned, */
      if ('error' in routeData) {
        /* no need to map over the errors because this is a status update */

        /* create or update the inactive and lastCheck time for the route */
        const saveRouteStatus = dynamodb
          .put({
            TableName: TABLE_NAME,
            Item: {
              [PARTITION_KEY]: 'route',
              [SORT_KEY]: `status_${rt}`,
              active: false,
              route: rt,
              lastChecked,
              ...routeDateCreated,
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
        // console.log('Error occurred for route: ' + rt)

        /* wait for the route update to finish saving */
        await saveRouteStatus

        /* // TODO: not sure why this is needed anymore */
        /* is needed to set bus active status to false */
        /* no longer needed again, the active route status was already set to false above */
        // return [{ rt, active: false, lastCheck: lastChecked }]
        return { vehicles: [] }
      }
    }

    return { vehicles: [] }
  }

  // /* get the current vehicle ids */
  // const { Items } = await client.query(metadataParams).promise()

  // /* get the vehicle ids for every route */
  // const allVehicles = await Promise.all(routes.map(getVehicles))

  let apiPatternCounts = 0

  const updatePatterns = async ({ rt, rtnm }: Route) => {
    /* get the current vehicle ids */
    const { Items: routeLaneDb } = await dynamodb
      .query(routeLaneParams(rt))
      .promise()

    /* should only be run once to populate dynamodb with route lat and lon */
    if (routeLaneDb?.length === 0) {
      /* then get the vehicles based on that rt parameter */
      const {
        data: response,
      } = await axios.get(
        'https://www.fairfaxcounty.gov/bustime/api/v3/getpatterns',
        { params: { ...defaultParams, rt } }
      )

      apiPatternCounts = apiPatternCounts + 1

      const routeLaneData = response['bustime-response']

      /* will save most amount of data--every stop and waypoint for every route-- ~20k records */
      if ('ptr' in routeLaneData) {
        const [pattern] = <Pattern[]>routeLaneData.ptr

        const { rtdir, pt } = pattern

        const routeLane = pt.reduce((store, item) => {
          const { typ, lat, lon, ...rest } = item

          const stopConstraint = typ === 'S' || typ === 'W'

          const stopType = stopConstraint && (typ === 'S' ? 'stop' : 'waypoint')

          return [
            ...store,
            {
              [PARTITION_KEY]: 'route',
              [SORT_KEY]: `map_${rt}_${stopType}_${rest.seq}`,
              routeDirection: rtdir,
              stopName: rest.stpnm,
              stopId: rest.stpid,
              sequence: rest.seq,
              lat,
              lon,
            },
          ]
        }, [] as RoutePatternItem[])

        await packageAndShip(routeLane)
      }
    }
  }

  await asyncPool(5, routes, updatePatterns)

  /* get the vehicle ids for every route and flatten the nested arrays */
  const apiVehicles = (await Promise.all(
    routes.flatMap(getVehiclesAndUpdateRoute)
  )) as {
    vehicles: Vehicle[]
    count?: number
  }[]

  /**
   * PT 2: update the vehicle ids in dynamodb.
   *
   * Wait for the api calls to dynamodb and the bus api to finish in parallel.
   * The `Promise.all` creates a 2d array of the api call.
   */

  /* flatten the 2d array returned from the the api call */
  const flatVehicles = apiVehicles.reduce(
    (store, item) => [...store, ...item.vehicles],
    [] as Vehicle[]
  )

  const finalApiCount =
    apiPatternCounts +
    apiVehicles.reduce(
      (total, item) => total + (item?.count! ?? 0),
      initialApiCount
    )

  console.log('Final api count', finalApiCount)

  const recentApiCountsItem = {
    [PARTITION_KEY]: 'api_counter',
    [SORT_KEY]: getNowISO(),
    calledBy: 'auditor',
    apiCount: finalApiCount,
  }

  const prevApiCountTotal = apiCountTotal?.[0]?.apiCountTotal ?? 0

  const totalApiCountsItem = {
    [PARTITION_KEY]: 'api_counter',
    [SORT_KEY]: 'total',
    lastUpdatedBy: 'auditor',
    lastUpdated: getNowISO(),
    apiCountTotal: prevApiCountTotal + finalApiCount,
  }

  /**
   * Update the vehicles based on the api result.
   *
   * This array of updated vehicles will only update the status of each
   * vehicle e.g. active and routes, not the locations and arrival times,
   * which is handled by the other more frequent lambda.
   */
  const updatedVehicleItems = flatVehicles.reduce((store, vehicle) => {
    /* Check if the vehicleIds returned from the api call exist in dynamodb */
    const inVehicleMap = vehicleMapDb[vehicle.vehicleId]

    /* define a common partition key */
    const partitionKey = {
      [PARTITION_KEY]: 'bus',
      [SORT_KEY]: `status_${vehicle.vehicleId}`,
    }

    /* create timestamps */
    const now = getNowISO()

    /* define the date created for the vehicles not in dynamodb */
    const dateCreated = now

    /* update the last checked for every vehicle */
    const lastChecked = now

    /* if the vehicleId does not exist in dynamodb, */
    if (!inVehicleMap) {
      /* and add it to the `newVehicles` array */
      return [
        ...store,
        { ...vehicle, ...partitionKey, dateCreated, lastChecked },
      ]
    }

    /**
     * otherwise check if the existing dynamodb vehicleId record
     * has encountered this vehicle on this route before.
     */

    const { routes } = inVehicleMap

    /* if the dynamodb vehicleId record has not encountered this route before, */
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

  const payload = [
    ...updatedVehicleItems,
    recentApiCountsItem,
    totalApiCountsItem,
  ].map((Item) => ({ PutRequest: { Item } }))

  // /* chunk the the payloads, */
  const requests = chunk(payload, MAX_DYNAMO_REQUESTS)

  try {
    /**
     * Then batch save all the items to dynamoDB,
     * one chunk at a time.
     */
    await Promise.all(requests.map(batchPutItems))
  } catch (error) {
    /* log error if failure */
    console.error(error)
  }

  stopwatch.stop()

  stopwatch.logElapsedSeconds()

  // /* define item */
  // const item = { [PARTITION_KEY]: 'testing', id: getNowISO() }

  // /* define params */
  // const putParams = { TableName: TABLE_NAME, Item: item }

  try {
    /* add item to dynamodb table */
    // await client.put(putParams).promise()

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
