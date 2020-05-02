import * as Dynamo from '../types/dynamodb'
import { winston } from '../utils/unicorns'

/* define environment variables */
const TABLE_NAME = process.env.TABLE_NAME || ''
const HIST_TABLE_NAME = process.env.HIST_TABLE_NAME || ''
const PARTITION_KEY = process.env.PARTITION_KEY || ''
const HIST_PARTITION_KEY = process.env.HIST_PARTITION_KEY || ''
const SORT_KEY = process.env.SORT_KEY || ''
const HIST_SORT_KEY = process.env.HIST_SORT_KEY || ''

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
  dateService,
}: Dynamo.DynamoServiceProviderProps) => {
  const getStatusOfBuses = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND #sk = :sk',
      ExpressionAttributeNames: { '#pk': PARTITION_KEY, '#sk': SORT_KEY },
      ExpressionAttributeValues: { ':pk': 'bus', ':sk': 'status' },
    }

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
    const statusOfBuses = results?.status ?? {}

    return { statusOfBuses, routeApiCount: 0 }
  }

  const getBusPredictions = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND #sk = :sk',
      ExpressionAttributeNames: { '#pk': PARTITION_KEY, '#sk': SORT_KEY },
      ExpressionAttributeValues: { ':pk': 'bus', ':sk': 'predictions' },
    }

    /* query dynamodb */
    const { Items } = await dynamodb.query(params).promise()

    /* extract the stop data */
    const [Item] = Items as Dynamo.BusesByRouteId[]

    const prevBusRoutes = Item?.routes ?? {}

    /* return the expected results */
    return { prevBusRoutes, apiCalls: 0 }
  }

  const getStops = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND #sk = :sk',
      ExpressionAttributeNames: { '#pk': PARTITION_KEY, '#sk': SORT_KEY },
      ExpressionAttributeValues: { ':pk': 'stop', ':sk': 'search' },
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

  const getMap = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skv)',
      ExpressionAttributeNames: { '#pk': PARTITION_KEY, '#sk': SORT_KEY },
      ExpressionAttributeValues: { ':pk': 'stop', ':skv': 'map_' },
    }

    type Map = {
      entity: string
      id: string
      map: {
        [key: string]: {
          stopId?: string
          stopName?: string
          sequence: number
          type: 'stop' | 'waypoint'
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
    const hoursSinceLastCheck = dateService.getDifferenceInHours(
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
      KeyConditionExpression: '#pk = :pk AND #sk BETWEEN :date1 AND :date2',
      ExpressionAttributeNames: { '#pk': PARTITION_KEY, '#sk': SORT_KEY },
      ExpressionAttributeValues: {
        ':pk': 'api_counter',
        ':date1': dateService.getStartOfDay(),
        ':date2': dateService.getEndOfDay(),
      },
    }
    const { Items } = await dynamodb.query(params).promise()
    return <Dynamo.ApiCountTodayItem[]>Items
  }

  const getApiCountTotal = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND #sk = :skv',
      ExpressionAttributeNames: { '#pk': PARTITION_KEY, '#sk': SORT_KEY },
      ExpressionAttributeValues: { ':pk': 'api_count', ':skv': 'total' },
    }

    const { Items } = await dynamodb.query(params).promise()

    if (Items!.length > 0) {
      const [item] = Items!
      return item.apiCountTotal as number
    }

    return 0
  }

  const getStatusOfActiveBuses = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skv)',
      ExpressionAttributeNames: { '#pk': PARTITION_KEY, '#sk': SORT_KEY },
      ExpressionAttributeValues: { ':pk': 'bus', ':skv': 'status' },
    }
    const { Items } = await dynamodb.query(params).promise()

    return (<Dynamo.BusStatusItem[]>Items)?.filter(isActiveRoute)
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
            KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skv)',
            ExpressionAttributeNames: { '#pk': PARTITION_KEY, '#sk': SORT_KEY },
            ExpressionAttributeValues: {
              ':pk': 'bus',
              ':skv': `v0_${activeBus.vehicleId}`,
            },
          })
          .promise()

        return Items as Dynamo.BusVehicleItem[]
      }
    )

    /* flatten the 2d array */
    return Promise.all(vehiclesOfActiveBuses).then(([vehicles]) => vehicles)
  }

  type DynamoOptions = { history?: boolean }

  const write = async (
    Item: Record<string, unknown>,
    options: DynamoOptions = {}
  ) => {
    /* define the params of the dynamoDB call */
    const params = {
      TableName: options.history ? HIST_TABLE_NAME : TABLE_NAME,
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
  ) => ({
    [options.history ? HIST_PARTITION_KEY : PARTITION_KEY]: pk,
    [options.history ? HIST_SORT_KEY : SORT_KEY]: sk,
    ...rest,
  })

  /**
   * Map an item to the format of a batch write request.
   * @param Item
   */
  const toPutRequest = <T>(Item: T) => ({
    PutRequest: { Item },
  })

  return {
    getMap,
    getStops,
    getBusPredictions,
    getStatusOfBuses,
    getApiCountToday,
    getApiCountTotal,
    // !NOTE - deprecated, delete from scribe 2.
    getStatusOfActiveBuses,
    getVehiclesOfActiveBuses,
    toPutRequest,
    generateItem,
    batchWrite,
    write,
  }
}
