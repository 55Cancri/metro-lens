import * as Dynamo from "./../types/dynamodb"

/* define environment variables */
const TABLE_NAME = process.env.TABLE_NAME || ""
const HIST_TABLE_NAME = process.env.HIST_TABLE_NAME || ""
const SORT_KEY = process.env.SORT_KEY || ""
const PARTITION_KEY = process.env.PARTITION_KEY || ""
const HIST_SORT_KEY = process.env.HIST_SORT_KEY || ""
const HIST_PARTITION_KEY = process.env.HIST_PARTITION_KEY || ""
const USERNAME_SORT_KEY = process.env.USERNAME_SORT_KEY || ""

export type VehicleStatus = { isActive: boolean; wentOffline: string | null }

export type PredictionStatus = { [vehicleId: string]: VehicleStatus }

export type PredictionIdStatus = {
  [vehicleId: string]: VehicleStatus & { predictionItemId: number }
}

export type Status = { [predictionId: string]: PredictionStatus }

export type VehicleStatusItem = {
  active: Status
  dormant: Status
}

export type Prediction = {
  arrivalIn: string
  arrivalTime: string
  stopId: string
  stopName: string
}

export type Vehicle = {
  lastUpdateTime: string
  lat: string
  lon: string
  rt: string
  vehicleId: string
  predictions?: Prediction[]
}

export type VehiclePredictionItem = {
  routes: { [routeIdVehicleId: string]: Vehicle }
}

export type PrimaryKey = {
  pk: string
  sk: string | number
}

export type Item = Record<string, unknown>

/**
 * Service to interface with dynamodb. Dependencies must be injected.
 * @param deps
 */
export const dynamoServiceProvider = (
  deps: Dynamo.DynamoServiceProviderProps
) => {
  const { dynamodb } = deps

  const TableName = TABLE_NAME
  const KeyConditionExpression = "#pk = :pk AND #sk = :sk"
  const ExpressionAttributeNames = { "#pk": PARTITION_KEY, "#sk": SORT_KEY }

  /**
   * Get the total number of api calls.
   */
  const getApiCountTotal = async () => {
    const ExpressionAttributeValues = { ":pk": "api_count", ":sk": "total" }
    const params = {
      TableName,
      KeyConditionExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }
    const { Items } = await dynamodb.query(params).promise()
    if (Items && Items.length > 0) {
      const [item] = Items
      return item.apiCountTotal as number
    }

    return 0
  }

  /**
   * Get the single vehicle status item that is organized by prediction set.
   */
  const getVehicleStatus = async () => {
    type StatusItem = PrimaryKey & { status: VehicleStatusItem }
    const ExpressionAttributeValues = { ":pk": "vehicle", ":sk": "status" }
    const params = {
      TableName,
      KeyConditionExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }
    const { Items } = await dynamodb.query(params).promise()
    const [Item] = Items as [StatusItem]
    const statusOfVehicles = Item?.status ?? {}
    return { statusOfVehicles, routeApiCount: 0 }
  }

  /**
   * Query for all prediction items. Expect 3-6 results.The number of
   * prediction items and the number of vehicles in each one is fully
   * controlled by the shape of the vehicle status item.
   */
  const getVehiclePredictions = async () => {
    type PredictionItem = PrimaryKey & VehiclePredictionItem
    const ExpressionAttributeValues = { ":pk": "prediction" }
    const params = {
      TableName,
      KeyConditionExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }
    const { Items } = await dynamodb.query(params).promise()
    return Items as PredictionItem[]
  }

  /**
   * Create an item for the main table.
   * @param Item
   */
  const createItem = ({ pk, sk, ...rest }: PrimaryKey & Item) => ({
    [PARTITION_KEY]: pk,
    [SORT_KEY]: sk,
    ...rest,
  })

  /**
   * Write an item to the main table.
   * @param Item
   */
  const writeItem = (Item: Item) => {
    const params = { TableName: TABLE_NAME, Item } as Dynamo.PutItemInput
    return dynamodb.put(params).promise()
  }

  /**
   * Create an item for the history table.
   * @param Item
   */
  const createHistoryItem = ({ pk, sk, ...rest }: PrimaryKey & Item) => ({
    [HIST_PARTITION_KEY]: pk,
    [HIST_SORT_KEY]: sk,
    ...rest,
  })

  /**
   * Write an item to the history table.
   * @param Item
   */
  const writeHistoryItem = (Item: Item) => {
    const params = { TableName: HIST_TABLE_NAME, Item } as Dynamo.PutItemInput
    return dynamodb.put(params).promise()
  }

  return {
    getApiCountTotal,
    getVehicleStatus,
    getVehiclePredictions,
    createItem,
    writeItem,
    createHistoryItem,
    writeHistoryItem,
  }
}
