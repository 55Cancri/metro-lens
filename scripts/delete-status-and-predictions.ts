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
type DeleteItemInput = aws.DynamoDB.DocumentClient.DeleteItemInput
const TableName = "metro"

type ParamKey = "vehicle" | "active-predictions"

const getParams = (entity: ParamKey, id: string): DeleteItemInput => ({
  TableName,
  Key: { entity, id },
})

const run = async () => {
  // const status = dynamodb.delete({}).promise()
  const status = dynamodb.delete(getParams("vehicle", "status")).promise()
  const scanner = dynamodb.delete(getParams("vehicle", "scanner")).promise()
  const one = dynamodb.delete(getParams("active-predictions", "1")).promise()
  const two = dynamodb.delete(getParams("active-predictions", "2")).promise()
  const three = dynamodb.delete(getParams("active-predictions", "3")).promise()
  return Promise.all([status, scanner, one, two, three])
}

const complete = () => console.log("Done.")
const error = (error: Error) => console.error(error)

run().then(complete).catch(error)
