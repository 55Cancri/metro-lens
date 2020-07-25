import aws from "aws-sdk"
import util from "util"
import * as utils from "./utils"
import { PutItemInput } from "aws-sdk/clients/dynamodb"
import * as R from "ramda"

const region = "us-east-1"
const profile = "default"
const credentials = new aws.SharedIniFileCredentials({ profile })

aws.config.update({ region })
aws.config.credentials = credentials
const dynamodb = new aws.DynamoDB.DocumentClient()
const TableName = "metro"

const ACTIVE_PREDICTION_SIZE = 25
const DORMANT_PREDICTION_SIZE = 150

type PrimaryKey = Record<"entity" | "id", string>

type Route = {
  lastUpdateTime: string
  lat: string
  lon: string
  rt: string
  vehicleId: string
  predictions?: {
    arrivalIn: string
    arrivalTime: string
    stopId: string
    stopName: string
  }[]
}

export type Status = {
  isActive: boolean
  wentOffline: string
}

type OldPredictionItem = {
  entity: "bus" | string
  id: "predictions" | string
  routes: { [key: string]: Route }
}

type PredictionItem = OldPredictionItem

type VehiclePredictionItem = {
  Items: OldPredictionItem[]
}

type OldStatus = {
  entity: "bus" | string
  id: "status" | string
  status: { [key: string]: Status }
}

type StatusItem = OldStatus

type OldStatusItem = {
  Items: OldStatus[]
}

const getParams = ({
  pk = "bus",
  sk,
}: Partial<Record<"pk" | "sk", string>>) => ({
  TableName,
  KeyConditionExpression: sk ? "#pk = :pk AND #sk = :sk" : "#pk = :pk",
  ExpressionAttributeNames: sk
    ? { "#pk": "entity", "#sk": "id" }
    : { "#pk": "entity" },
  ExpressionAttributeValues: { ":pk": pk, ...(sk ? { ":sk": sk } : {}) },
})

const putItem = async (Item: unknown) =>
  dynamodb
    .put({
      TableName,
      Item: Item,
    } as PutItemInput)
    .promise()

const getVehicleIds = <T extends object>(value: T) =>
  Object.keys(value).map((key) => {
    /* split the key to get the ending vehicle id */
    const [, vehicleId] = key.split("_")

    return vehicleId
  })

// parse out the vehicle routes that have predictions
const hasPredictions = ([key, value]: [string, Route]) =>
  Array.isArray(value.predictions)

// run the main function
const run = async () => {
  const vehicleOldPredictionParams = getParams({ pk: "bus", sk: "predictions" })
  const vehicleOldPredictionResults = await dynamodb
    .query(vehicleOldPredictionParams as any)
    .promise()

  const vehicleNewPredictionParams = getParams({ pk: "active-predictions" })
  const vehicleNewPredictionsResults = await dynamodb
    .query(vehicleNewPredictionParams as any)
    .promise()

  const {
    Items: oldPredictionResponseItems,
  } = (vehicleOldPredictionResults as unknown) as VehiclePredictionItem
  const {
    Items: newPredictionResponseItems,
  } = (vehicleNewPredictionsResults as unknown) as {
    Items: { entity: "active-predictions"; id: string }[]
  }

  console.log("Starting deletion.")

  // clear all active-prediction items
  const deleteActivePredictions = newPredictionResponseItems.map(
    async ({ entity, id }) => {
      const Key = { entity, id }
      return dynamodb
        .delete({ TableName, Key })
        .promise()
        .then(() => console.log("Deleted."))
        .catch(() => console.log("Error."))
    }
  )
  await Promise.all(deleteActivePredictions).catch(() => console.log("Error."))

  // extract the routes from the items
  const [{ routes }] = oldPredictionResponseItems

  // partiion vehicles based on the existence of their predictions
  const [activeVehicles, inactiveVehicles] = utils.partition(
    Object.entries(routes),
    hasPredictions
  )

  // chunk the active buses into 75 items
  const chunkedActiveVehicles = utils.chunk(
    activeVehicles,
    ACTIVE_PREDICTION_SIZE
  )

  // chunk the dormant buses into 250 items
  const chunkedDormantVehicles = utils.chunk(
    inactiveVehicles,
    DORMANT_PREDICTION_SIZE
  )

  /* create the new prediction items for the active buses */
  const activePredictionItems = chunkedActiveVehicles.reduce(
    (store, activeVehicleList, i) => {
      const routes = Object.fromEntries(activeVehicleList)
      const entity = "active-predictions"
      const id = String(i + 1)
      const item = { entity, id, routes }
      return [...store, item]
    },
    [] as PredictionItem[]
  )

  /* create the new prediction items for the dormant buses */
  const dormantPredictionItems = chunkedDormantVehicles.reduce(
    (store, dormantBusesList, i) => {
      const routes = Object.fromEntries(dormantBusesList)
      // const allVehicles = Object.keys(routes)
      const entity = "dormant-predictions"
      const id = String(i + 1)
      const item = { entity, id, routes }
      // const item = { entity, id, routes, allVehicles }
      return [...store, item]
    },
    [] as PredictionItem[]
  )

  const statusParams = getParams({ pk: "bus", sk: "status" })
  const statusResults = await dynamodb.query(statusParams as any).promise()
  const {
    Items: statusResponseItems,
  } = (statusResults as unknown) as OldStatusItem
  const [{ status }] = statusResponseItems

  const activeStatus = activePredictionItems.reduce((store, predictionSet) => {
    const vehicleIds = getVehicleIds(predictionSet.routes)

    /* iterate through the keys to get the vehicleId to get the matching status */
    const vehicleStatus = vehicleIds.reduce((store, key) => {
      /* use that vehicle id to get the corresponding status */
      const vehicleMatch = status[key]

      /* put that vehicle status in this specific prediction set */
      return vehicleMatch ? { ...store, [key]: vehicleMatch } : store
    }, {})

    /* return the finalized status object */
    return { ...store, [predictionSet.id]: vehicleStatus }
  }, {} as {})

  const dormantStatus = dormantPredictionItems.reduce(
    (store, predictionSet) => {
      /* get the vehicle ids */
      const vehicleIds = getVehicleIds(predictionSet.routes)

      /* iterate through the keys to get the vehicleId to get the matching status */
      const vehicleStatus = vehicleIds.reduce((store, key) => {
        /* use that vehicle id to get the corresponding status */
        const vehicleMatch = status[key]

        /* put that vehicle status in this specific prediction set */
        return vehicleMatch ? { ...store, [key]: vehicleMatch } : store
      }, {})

      /* update the list of all of the vehicle ids */
      // const allVehicleIds = [...store.allVehicleIds, ...vehicleIds]

      /* return the finalized status object */
      return { ...store, [predictionSet.id]: vehicleStatus }
      // return { ...store, [predictionSet.id]: vehicleStatus, allVehicleIds }
    },
    {} as {}
  )

  const Item = {
    entity: "vehicle",
    id: "status",
    active: activeStatus,
    dormant: dormantStatus,
  }
  const params = { TableName, Item }
  return dynamodb.put(params).promise()
}

/* execute program and catch errors */
run()
  .then(() => console.log("Done."))
  .catch((error: Error) => console.error(error))
