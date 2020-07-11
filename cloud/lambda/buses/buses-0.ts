/* buses-0 is always the most recent version */
import * as aws from "aws-sdk"
import * as lambda from "aws-lambda"
import axios from "axios"
import * as R from "ramda"
import * as Rx from "rxjs"
import * as Op from "rxjs/operators"

/* import services */
import { dynamoServiceProvider } from "../services/dynamodb-1"
import { dateServiceProvider } from "../services/date"

/* import utils */
import * as listUtils from "../utils/lists"
import * as objectUtils from "../utils/objects"
import * as unicornUtils from "../utils/unicorns"

const { winston } = unicornUtils

/* import types */
import * as Dynamo from "../types/dynamodb"
import * as Misc from "../types/misc"

/* ensure the dynamo table is in the correct region */
aws.config.update({ region: "us-east-1" })

/* initialize the environment variables */
const CONNECTOR_KEY = process.env.CONNECTOR_KEY || ""
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || ""
const MAX_DYNAMO_REQUESTS = 25

/* define error constants */
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`

/* setup dynamodb client */
const dynamodb = new aws.DynamoDB.DocumentClient()

type Props = {
  predictionSet: number
}

/**
 * Query dynamodb every minutes for the updates of the
 * buses updated in the last 5 minutes.
 * @param event
 */
export const handler = async (event?: Misc.AppsyncEvent<Props>) => {
  winston.info("Starting.")

  console.log("LAMBDA EVENT:")
  console.log(event)

  /* initialize services */
  // !NOTE: do not instantiate these here.
  // !Do so in a wrapper for the lambda so they can be injected
  const date = dateServiceProvider()
  const dynamoService = dynamoServiceProvider({ dynamodb, date })

  /* query dynamodb for all of the bus predictions */
  const {
    prevBusRoutes: busPredictions,
  } = await dynamoService.getBusPredictions()

  /* convert the large bus predictions object into an array */
  const busResponse = Object.values(busPredictions)

  /* filter out buses that were last updated greater than 5 minutes ago */
  const buses = busResponse.filter(
    (bus) => bus.predictions && date.elapsedMinsLessThan(bus.lastUpdateTime, 5)
  )

  /* logs */
  unicornUtils.print(buses)

  console.log("Logged predictions. Returning sample response.")

  // return buses
  const mockBuses = [
    {
      lastUpdateTime: "2020-05-27T22:00:52.790Z",
      lat: "38.71017074584961",
      lon: "-77.06358337402344",
      rt: "101",
      vehicleId: "7708",
      predictions: [
        {
          arrivalIn: "8",
          arrivalTime: "2020-05-29T12:35:00.000Z",
          stopId: "934",
          stopName: "Mt Vernon Estate",
        },
      ],
    },
  ]

  console.log("UnFiltered buses length:")
  console.log(busResponse.length)

  console.log("UnFiltered buses size:")
  console.log(unicornUtils.formatBytes(objectUtils.sizeOf(busResponse)))

  console.log("Filtered buses length:")
  console.log(buses.length)

  console.log("Filtered buses size:")
  console.log(unicornUtils.formatBytes(objectUtils.sizeOf(buses)))

  console.log("Filtered buses length:")
  console.log(buses.length)

  console.log("Mock buses size:")
  console.log(unicornUtils.formatBytes(objectUtils.sizeOf(mockBuses)))

  return buses
  // return mockBuses
}
