import aws from "aws-sdk"
import util from "util"
import * as utils from "./utils"
import { PutItemInput } from "aws-sdk/clients/dynamodb"
import * as R from "ramda"
const region = "us-east-1"

/* use dev nonprod account */
const profile = "default"

/* set credentials */
const credentials = new aws.SharedIniFileCredentials({ profile })
aws.config.update({ region })

/* enable promises */
aws.config.credentials = credentials

/* create dynamo instance */
const dynamoDb = new aws.DynamoDB.DocumentClient()
/* define the table name */
const TableName = "metro"

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

type PredictionItem = OldPredictionItem & { allVehicles: string[] }

type BusPredictionItem = {
  Items: OldPredictionItem[]
}

type OldStatusItem = {
  entity: "bus" | string
  id: "status" | string
  status: { [key: string]: Status }
}

type StatusItem = OldStatusItem & { allVehicles: string[] }

type BusStatusItem = {
  Items: OldStatusItem[]
}

const getParams = (sortKey: string) => ({
  TableName,
  KeyConditionExpression: "#pk = :pk AND #sk = :sk",
  ExpressionAttributeNames: { "#pk": "entity", "#sk": "id" },
  ExpressionAttributeValues: { ":pk": "bus", ":sk": sortKey },
})

const putItem = async (Item: unknown) =>
  dynamoDb
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

/* run the main function */
const run = async () => {
  /* define the params object */
  const predictionsParams = getParams("predictions")

  /* query the table for api counts in the date range */
  const predictionResults = (await dynamoDb
    .query(predictionsParams)
    .promise()) as unknown

  /* extract the items */
  const {
    Items: predictionResponseItems,
  } = predictionResults as BusPredictionItem

  /* extract the routes from the items */
  const [{ routes }] = predictionResponseItems

  /* parse out the bus routes that have predictions */
  const hasPredictions = ([key, value]: [string, Route]) =>
    Array.isArray(value.predictions)

  /* partiion the buses into those that have predictions and those that do not */
  const [activeBuses, inactiveBuses] = utils.partition(
    Object.entries(routes),
    hasPredictions
  )

  /* chunk the active buses into 75 items */
  const chunkedActiveBuses = utils.chunk(activeBuses, 75)

  /* chunk the dormant buses into 250 items */
  const chunkedDormantBuses = utils.chunk(inactiveBuses, 250)

  /* create the new prediction items for the active buses */
  const activePredictionItems = chunkedActiveBuses.reduce(
    (store, activeBusesList, i) => {
      const routes = Object.fromEntries(activeBusesList)
      const allVehicles = Object.keys(routes)
      const entity = "active-predictions"
      const id = String(i + 1)
      const item = { entity, id, routes, allVehicles }
      return [...store, item]
    },
    [] as PredictionItem[]
  )

  /* create the new prediction items for the dormant buses */
  const dormantPredictionItems = chunkedDormantBuses.reduce(
    (store, dormantBusesList, i) => {
      const routes = Object.fromEntries(dormantBusesList)
      const allVehicles = Object.keys(routes)
      const entity = "dormant-predictions"
      const id = String(i + 1)
      const item = { entity, id, routes, allVehicles }
      return [...store, item]
    },
    [] as PredictionItem[]
  )

  /* create the new prediction items for the active buses */
  // const predictionItems = chunkedActiveBuses.reduce(
  //   (store, activeBusesList, i) => {
  //     const routes = Object.fromEntries(activeBusesList)
  //     const allBuses = Object.keys(routes)
  //     const entity = 'predictions'
  //     const id = String(i + 1)
  //     const item = { entity, id, routes, allBuses }

  //     return [...store, item]
  //   },
  //   [] as PredictionItem[]
  // )

  // console.log(predictionResponseItems)

  /* define the params object */
  const statusParams = getParams("status")

  /* query the table for api counts in the date range */
  const statusResults = (await dynamoDb
    .query(statusParams)
    .promise()) as unknown

  /* extract the items */
  const { Items: statusResponseItems } = statusResults as BusStatusItem

  /* extract the routes from the items */
  const [{ status }] = statusResponseItems

  const activeStatus = activePredictionItems.reduce(
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
      const allVehicleIds = [...store.allVehicleIds, ...vehicleIds]

      /* return the finalized status object */
      return { ...store, [predictionSet.id]: vehicleStatus, allVehicleIds }
    },
    { allVehicleIds: [] } as { allVehicleIds: string[] }
  )

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
      const allVehicleIds = [...store.allVehicleIds, ...vehicleIds]

      /* return the finalized status object */
      return { ...store, [predictionSet.id]: vehicleStatus, allVehicleIds }
    },
    { allVehicleIds: [] } as { allVehicleIds: string[] }
  )

  // console.log({ configureStatus })

  /* create the updated bus status item */
  // const busStatusItem =
  // type PutItem = aws.DynamoDB.DocumentClient.PutItemInput
  // type Error = aws.AWSError

  /* store the active prediction sets */
  await Promise.all(activePredictionItems.map(putItem))
  // await activePredictionItems.reduce(
  //   async (store, item) => store.then(() => putItem(item)),
  //   Promise.resolve([])
  // )
  // Promise.resolve(undefined) as Promise<Request<PutItem, Error>>

  console.log("Active predictions.")

  /* store the dormant prediction sets */
  await Promise.all(dormantPredictionItems.map(putItem))

  console.log("Dormant predictions.")

  console.log("Uploading status item.")

  const params = {
    TableName,
    Item: {
      entity: "vehicle",
      id: "status",
      active: activeStatus,
      dormant: dormantStatus,
    },
  }

  // utils.trace(params)

  /* write the new bus status object to dynamodb */
  return dynamoDb.put(params).promise()
}

/* execute program and catch errors */
run()
  .then(() => console.log("Done."))
  .catch((error: Error) => console.error(error))
