import * as Iam from "../types/iam"
import * as Dynamo from "../types/dynamodb"
import { winston } from "../utils/unicorns"
import * as listUtils from "../utils/lists"

/* define environment variables */
const TABLE_NAME = process.env.TABLE_NAME || ""
const HIST_TABLE_NAME = process.env.HIST_TABLE_NAME || ""
const SORT_KEY = process.env.SORT_KEY || ""
const PARTITION_KEY = process.env.PARTITION_KEY || ""
const HIST_SORT_KEY = process.env.HIST_SORT_KEY || ""
const HIST_PARTITION_KEY = process.env.HIST_PARTITION_KEY || ""
const USERNAME_SORT_KEY = process.env.USERNAME_SORT_KEY || ""

/**
 * The primary keys are:
 * "api_counter", [timestamp]
 * "api_counter", "total"
 * "bus", "route_id"
 * "bus", "status"
 * "route", "map_" + [routeId] + "_stop_" + [stopId]
 * "route", "map_" + [routeId] + "_waypoint_" + [sequence]
 *
 */

/**
 * Service to interface with dynamodb. Dependencies must be injected.
 * @param deps
 */
export const dynamoServiceProvider = ({
  dynamodb,
  date,
}: Dynamo.DynamoServiceProviderProps) => {
  type DynamoOptions = { historyTable?: boolean; usernameIndex?: boolean }

  const generateItem = (
    {
      pk,
      sk,
      ...rest
    }: {
      pk: string
      sk: string
      [key: string]: unknown
    },
    options: DynamoOptions = {}
  ) => {
    if (options.historyTable) {
      return { [HIST_PARTITION_KEY]: pk, [HIST_SORT_KEY]: sk, ...rest }
    }

    if (options.usernameIndex) {
      return { [PARTITION_KEY]: pk, [USERNAME_SORT_KEY]: sk, ...rest }
    }

    return { [PARTITION_KEY]: pk, [SORT_KEY]: sk, ...rest }
  }

  const saveUser = async (user: Iam.PartialUser) => {
    const defaults = {
      favoriteStops: [],
      locations: [],
    }

    const Item = generateItem({
      pk: "user",
      sk: user.email,
      uuid: user.uuid,
      email: user.email,
      username: user.username,
      password: user.password,
      dateCreated: user.dateCreated,
      lastSignOn: user.lastSignOn,
      ...defaults,
    })

    await dynamodb.put({ TableName: TABLE_NAME, Item }).promise()

    return { ...user, ...defaults }
  }

  const findUser = async (emailOrUsername: string) => {
    type Options = {
      useIndex: boolean
    }

    /* return the params object */
    const getParams = (sortKeyValue: string, options?: Options) => {
      /* determine if user local secondary index should be used */
      const withIndex = options?.useIndex ? { IndexName: "usernameIndex" } : {}
      const sortKeyName = options?.useIndex ? USERNAME_SORT_KEY : SORT_KEY

      return {
        ...withIndex,
        TableName: TABLE_NAME,
        KeyConditionExpression: "#pk = :pk AND #sk = :sk",
        ExpressionAttributeNames: { "#pk": PARTITION_KEY, "#sk": sortKeyName },
        ExpressionAttributeValues: { ":pk": "user", ":sk": sortKeyValue },
      } as Dynamo.QueryParams
    }

    const { Items: emailItems = [] } = await dynamodb
      .query(getParams(emailOrUsername))
      .promise()

    if (emailItems.length > 0) {
      const [userItemByEmail] = emailItems

      return userItemByEmail as Dynamo.User
    }

    const { Items: usernameItems = [] } = await dynamodb
      .query(getParams(emailOrUsername, { useIndex: true }))
      .promise()

    if (usernameItems.length > 0) {
      const [userItemByUsername] = usernameItems

      return userItemByUsername as Dynamo.User
    }

    /* user does not exist */
    return {} as Dynamo.User
  }

  const getPredictionParams = (predictionSet: number) => {
    return {
      TableName: TABLE_NAME,
      KeyConditionExpression: "#pk = :pk AND #sk = :sk",
      ExpressionAttributeNames: {
        "#pk": PARTITION_KEY,
        "#sk": SORT_KEY,
      },
      ExpressionAttributeValues: {
        ":pk": "bus",
        ":sk": `predictions-${predictionSet}`,
      },
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                         Auditor and Scribe lambdas                         */
  /* -------------------------------------------------------------------------- */

  const getStatusOfBuses = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "#pk = :pk AND #sk = :sk",
      ExpressionAttributeNames: { "#pk": PARTITION_KEY, "#sk": SORT_KEY },
      ExpressionAttributeValues: { ":pk": "bus", ":sk": "status" },
    }

    // TODO: { dormant: { ... }, active: { ... } }
    type BusStatus = {
      entity: string
      id: string
      status: {
        [key: string]: { isActive: boolean; wentOffline: string | null }
      }
    }

    /* query dynamodb */
    const { Items } = await dynamodb.query(params).promise()

    const [results] = Items as BusStatus[]

    /* determine the status of the buses */
    // TODO: change to results.active & results.dormant
    const statusOfBuses = results?.status ?? {}

    // TODO: { dormant, active, routeApiCount }
    return { statusOfBuses, routeApiCount: 0 }
  }

  const getBusPredictions = async (predictionSet?: number) => {
    /* get the first prediction set */
    const params = getPredictionParams(0)

    /* query dynamodb */
    const { Items } = await dynamodb.query(params).promise()

    /* extract the stop data */
    const [Item] = Items as Dynamo.BusesByRouteId[]

    /**
     * This conditional happens when the buses lambda queries by
     * the page number it receives
     */
    if (!predictionSet) {
      const prevBusRoutes = Item?.routes ?? {}

      /* return the expected results */
      return { prevBusRoutes, apiCalls: 0 }
    }

    /**
     * Get the total prediction sets from the item, which is determined
     * in the scribe lambda by the length of the vehicles list chunked
     * into groups of 7.
     * */
    const { totalPredictionSets } = Item

    if (totalPredictionSets && totalPredictionSets > 1) {
      type Routes = Dynamo.BusesByRouteId["routes"]

      const predictionSets = listUtils.createList(totalPredictionSets)

      const prevBusRoutes = (await predictionSets.reduce(
        async (store, _, i) => {
          /* wait for the promise to resolve */
          const routes = (await store) as Routes

          /* we already queried the first prediction above so skip it */
          if (i === 0) return routes

          /* get the params for each prediction set */
          const params = getPredictionParams(i)

          /* query dynamodb */
          const { Items } = await dynamodb.query(params).promise()

          /* extract the stop data */
          const [Item] = Items as Dynamo.BusesByRouteId[]

          /* get the bus routes */
          const prevBusRoutes = Item?.routes ?? {}

          return { ...routes, ...prevBusRoutes }
        },
        Promise.resolve({}) as Promise<Routes>
      )) as Routes

      /* return the expected results */
      return { prevBusRoutes, apiCalls: 0 }
    }

    /* return empty results */
    return { prevBusRoutes: {}, apiCalls: 0 }
  }

  const getStops = async () => {
    /* the stops are grouped by route id */
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :skv)",
      ExpressionAttributeNames: { "#pk": PARTITION_KEY, "#sk": SORT_KEY },
      ExpressionAttributeValues: { ":pk": "stop", ":skv": "route_id_" },
    }

    type Stop = {
      entity: string
      id: string
      stops: {
        [key: string]: {
          lat: string
          lon: string
          routeId: string
          stopId: string
          stopName: string
        }
      }[]
    }

    /* query dynamodb */
    const { Items } = await dynamodb.query(params).promise()

    /* extract the bus data */
    const [Item] = Items as Stop[]

    /* get the stop ids */
    const stops = Item?.stops ?? {}

    /* return the expected results */
    return { stops, dbStopsApiCount: 0 }
  }

  const getMaps = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :skv)",
      ExpressionAttributeNames: { "#pk": PARTITION_KEY, "#sk": SORT_KEY },
      ExpressionAttributeValues: { ":pk": "route", ":skv": "map_" },
    }

    type Map = {
      entity: string
      id: string
      map: {
        [key: string]: {
          stopId?: string
          stopName?: string
          sequence: number
          type: "stop" | "waypoint"
          routeDirection: string
          lat: string
          lon: string
        }
      }[]
    }

    /* query dynamodb */
    const { Items } = await dynamodb.query(params).promise()

    /* extract the map data */
    const [Item] = Items as Map[]

    /* get the map */
    const map = Item?.map ?? []

    // console.log('Map dynamodb - Items:')
    // console.log(Items?.length ?? 0)

    // console.log('Map dynamodb - .map:')
    // console.log(map?.length ?? 0)

    /* return the expected results */
    return { map, dbMapApiCount: 0 }
  }

  /* ============================================================ */

  /**
   * Determine if a route should be checked by making sure it is not active
   * and the last check was over 12 hours ago.
   *
   * @param routeObject routeObject - the data of a specific route in dynamodb
   */
  const isActiveRoute = (routeObject: Dynamo.BusStatusItem) => {
    const hoursSinceLastCheck = date.getDifferenceInHours(
      new Date(),
      new Date(Number(routeObject.lastChecked))
    )

    // this should be the logic for the auditor, scribe only cares about active
    // return !routeObject.active || hoursSinceLastCheck > 12

    return routeObject.active
  }

  const getApiCountToday = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "#pk = :pk AND #sk BETWEEN :date1 AND :date2",
      ExpressionAttributeNames: { "#pk": PARTITION_KEY, "#sk": SORT_KEY },
      ExpressionAttributeValues: {
        ":pk": "api_counter",
        ":date1": date.getStartOfDay(),
        ":date2": date.getEndOfDay(),
      },
    }
    const { Items } = await dynamodb.query(params).promise()

    return Items as Dynamo.ApiCountTodayItem[]
  }

  const getApiCountTotal = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "#pk = :pk AND #sk = :skv",
      ExpressionAttributeNames: { "#pk": PARTITION_KEY, "#sk": SORT_KEY },
      ExpressionAttributeValues: { ":pk": "api_count", ":skv": "total" },
    }

    const { Items } = await dynamodb.query(params).promise()

    if (Items && Items?.length > 0) {
      const [item] = Items

      return item.apiCountTotal as number
    }

    return 0
  }

  const getStatusOfActiveBuses = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :skv)",
      ExpressionAttributeNames: { "#pk": PARTITION_KEY, "#sk": SORT_KEY },
      ExpressionAttributeValues: { ":pk": "bus", ":skv": "status" },
    }
    const { Items } = await dynamodb.query(params).promise()

    return (Items as Dynamo.BusStatusItem[])?.filter(isActiveRoute)
  }

  const getVehiclesOfActiveBuses = async (
    retrievedStatusOfActiveBuses: Dynamo.BusStatusItem[] = []
  ) => {
    /* get the metadata for buses with active status */
    const statusOfActiveBuses =
      retrievedStatusOfActiveBuses?.length > 0
        ? retrievedStatusOfActiveBuses
        : await getStatusOfActiveBuses()

    /* get the realtime data dynamodb items for the active buses */
    const vehiclesOfActiveBuses = retrievedStatusOfActiveBuses.map(
      async (activeBus) => {
        const { Items } = await dynamodb
          .query({
            TableName: TABLE_NAME,
            KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :skv)",
            ExpressionAttributeNames: { "#pk": PARTITION_KEY, "#sk": SORT_KEY },
            ExpressionAttributeValues: {
              ":pk": "bus",
              ":skv": `v0_${activeBus.vehicleId}`,
            },
          })
          .promise()

        return Items as Dynamo.BusVehicleItem[]
      }
    )

    /* flatten the 2d array */
    return Promise.all(vehiclesOfActiveBuses).then(([vehicles]) => vehicles)
  }

  const write = async (
    Item: Record<string, unknown>,
    options: DynamoOptions = {}
  ) => {
    /* define the params of the dynamoDB call */
    const params = {
      TableName: options.historyTable ? HIST_TABLE_NAME : TABLE_NAME,
      Item,
    } as Dynamo.PutItemInput

    // winston.info(
    //   'Dynamo Put to ' +
    //     params.TableName +
    //     ' for key ' +
    //     Item.entity +
    //     ' / ' +
    //     Item.id
    // )

    /* call the batch write to save the items to the table */
    return dynamodb.put(params).promise()
  }

  const batchWrite = async (requests: Dynamo.WriteRequest[]) => {
    /* define the params of the dynamoDB call */
    const params = { RequestItems: { [TABLE_NAME]: requests } }

    /* call the batch write to save the items to the table */
    return dynamodb.batchWrite(params).promise() as Dynamo.BatchWriteOutput
  }

  /**
   * Map an item to the format of a batch write request.
   * @param Item
   */
  const toPutRequest = <T>(Item: T) => ({
    PutRequest: { Item },
  })

  return {
    /* dynamodb operations */
    write,
    batchWrite,
    generateItem,
    toPutRequest,

    /* user dynamodb queries */
    findUser,
    saveUser,

    /* lambda dynamodb */
    getMaps,
    getStops,
    getBusPredictions,
    getStatusOfBuses,
    getApiCountToday,
    getApiCountTotal,
    // !NOTE - deprecated, delete from scribe 2.
    getStatusOfActiveBuses,
    getVehiclesOfActiveBuses,
  }
}
