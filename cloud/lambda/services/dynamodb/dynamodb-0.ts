import * as aws from "aws-sdk"
import * as Dynamo from "./types"

/* define environment variables */
const TABLE_NAME = process.env.TABLE_NAME || ""
const HIST_TABLE_NAME = process.env.HIST_TABLE_NAME || ""
const SORT_KEY = process.env.SORT_KEY || ""
const PARTITION_KEY = process.env.PARTITION_KEY || ""
const HIST_SORT_KEY = process.env.HIST_SORT_KEY || ""
const HIST_PARTITION_KEY = process.env.HIST_PARTITION_KEY || ""
const USERNAME_SORT_KEY = process.env.USERNAME_SORT_KEY || ""

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
   * Get the map markers for every route.
   */
  const getMapMarkers = async () => {
    const params = {
      TableName,
      KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
      ExpressionAttributeNames,
      ExpressionAttributeValues: { ":pk": "route", ":sk": "map_" },
    }
    const { Items } = await dynamodb.query(params).promise()
    const [Item] = Items as Dynamo.MapItem[]
    return Item?.map ?? []
  }

  /**
   * Get the stops for every vehicle route.
   */
  const getVehicleStops = async () => {
    /* the stops are grouped by route id */
    const params = {
      TableName,
      KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
      ExpressionAttributeNames,
      ExpressionAttributeValues: { ":pk": "stop", ":sk": "route_id_" },
    }
    const { Items } = await dynamodb.query(params).promise()
    const [Item] = Items as Dynamo.VehicleStopItem[]
    return Item?.stops ?? {}
    // return { stops, vehicleStopApiCount: 0 }
  }

  /**
   * Get the single vehicle status item that is subdivided by active
   * and dormant vehicles, and further subdivided by prediction set.
   */
  const getVehicleStatus = async () => {
    const ExpressionAttributeValues = { ":pk": "vehicle", ":sk": "status" }
    const params = {
      TableName,
      KeyConditionExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }
    const { Items } = await dynamodb.query(params).promise()
    const [Item] = Items as [Dynamo.VehicleStatusItem]
    const statusOfVehicles = (Item?.active && Item?.dormant
      ? Item
      : {}) as Dynamo.VehicleStatusItem
    return { statusOfVehicles, routeApiCount: 0 }
  }

  /**
   * Query for all prediction items. Expect 3-6 results.The number of
   * prediction items and the number of vehicles in each one is fully
   * controlled by the shape of the vehicle status item.
   */
  const getActivePredictions = async (groupId?: number) => {
    const KeyConditionExpression = groupId
      ? "#pk = :pk AND #sk = :sk"
      : "#pk = :pk"
    const ExpressionAttributeValues = groupId
      ? { ":pk": "active-predictions", ":sk": groupId }
      : { ":pk": "active-predictions" }
    const params = {
      TableName,
      KeyConditionExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }
    const { Items } = await dynamodb.query(params).promise()
    return Items as Dynamo.PredictionItem[]
  }

  const getDormantPredictions = async () => {
    const KeyConditionExpression = "#pk = :pk"
    const ExpressionAttributeValues = { ":pk": "dormant-predictions" }
    const params = {
      TableName,
      KeyConditionExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }
    const { Items } = await dynamodb.query(params).promise()
    return Items as Dynamo.PredictionItem[]
  }

  /**
   * Map an item to the format of a batch write request.
   * @param Item
   */
  const toPutRequest = <T>(Item: T) => ({ PutRequest: { Item } })

  /**
   * Create an item for the main table.
   * @param Item
   */
  const createItem = ({
    pk: pk,
    sk: sk,
    ...rest
  }: Dynamo.CreateItemParams & Dynamo.Item) => ({
    [PARTITION_KEY]: pk,
    [SORT_KEY]: sk,
    ...rest,
  })

  /**
   * Write an item to the main table.
   * @param Item
   */
  const writeItem = (Item: Dynamo.Item) => {
    const params = { TableName: TABLE_NAME, Item } as Dynamo.PutItemInput
    return dynamodb.put(params).promise()
  }

  /**
   * Create an item for the history table.
   * @param Item
   */
  const createHistoryItem = ({
    pk: pk,
    sk: sk,
    ...rest
  }: Dynamo.CreateItemParams & Dynamo.Item) => ({
    [HIST_PARTITION_KEY]: pk,
    [HIST_SORT_KEY]: sk,
    ...rest,
  })

  /**
   * Write an item to the history table.
   * @param Item
   */
  const writeHistoryItem = (Item: Dynamo.Item) => {
    const params = { TableName: HIST_TABLE_NAME, Item } as Dynamo.PutItemInput
    return dynamodb.put(params).promise()
  }

  const batchWriteItem = async (requests: Dynamo.WriteRequest[]) => {
    const params = { RequestItems: { [TABLE_NAME]: requests } }
    return dynamodb.batchWrite(params).promise() as Dynamo.BatchWriteOutput
  }

  return {
    getApiCountTotal,
    getMapMarkers,
    getVehicleStops,
    getVehicleStatus,
    getActivePredictions,
    getDormantPredictions,
    toPutRequest,
    createItem,
    writeItem,
    batchWriteItem,
    createHistoryItem,
    writeHistoryItem,
  }
}
