import aws from "aws-sdk"
import util from "util"
import * as utils from "./utils"
import * as Dynamo from "../cloud/lambda/services/dynamodb/types"
import { PutItemInput } from "aws-sdk/clients/dynamodb"
import * as R from "ramda"

const region = "us-east-1"
const profile = "default"
const credentials = new aws.SharedIniFileCredentials({ profile })
aws.config.update({ region, credentials })

const dynamodb = new aws.DynamoDB.DocumentClient()
const TableName = "metro"

type ParamKey = "status" | "active-predictions"

const getParams = (key: ParamKey): Dynamo.QueryParams => {
  if (key === "status") {
    return {
      TableName,
      KeyConditionExpression: "#pk = :pk AND #sk = :sk",
      ExpressionAttributeNames: { "#pk": "entity", "#sk": "id" },
      ExpressionAttributeValues: { ":pk": "vehicle", ":sk": key },
    }
  }

  if (key === "active-predictions") {
    return {
      TableName,
      KeyConditionExpression: "#pk = :pk",
      ExpressionAttributeNames: { "#pk": "entity" },
      ExpressionAttributeValues: { ":pk": key },
    }
  }

  throw new Error()
}

const run = async () => {
  console.log("\nSTATUS")
  const { Items: statusItems } = await dynamodb
    .query(getParams("status"))
    .promise()
  const [statusItem] = statusItems as [Dynamo.VehicleStatusItem]
  const { active } = statusItem
  Object.entries(active).map(([predictionGroupId, predictionGroup]) => {
    const vehicleIds = Object.keys(predictionGroup).join(",")
    console.log(predictionGroupId, ":", vehicleIds)
  })

  console.log("\nACTIVE PREDICTIONS")
  const { Items: activePredictionItems } = await dynamodb
    .query(getParams("active-predictions"))
    .promise()
  activePredictionItems?.map((activePredictionItem) => {
    const { id, routes } = activePredictionItem as Dynamo.PredictionItem
    const routeIdVehicleIds = Object.keys(routes).join(",")
    console.log(id, ":", routeIdVehicleIds)
  })
}

const complete = () => console.log("Done.")
const error = (error: Error) => console.error(error)

run().then(complete).catch(error)
