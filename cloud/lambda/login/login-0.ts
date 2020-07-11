/* login-0 is always the most recent version */
import * as aws from "aws-sdk"
import * as lambda from "aws-lambda"
import * as jwt from "jsonwebtoken"
import * as bcrypt from "bcryptjs"
// import * as R from 'ramda'
// import * as Rx from 'rxjs'
// import * as Op from 'rxjs/operators'

/* import services */
import { apiServiceProvider } from "../services/api-1"
import { dynamoServiceProvider } from "../services/dynamodb-1"
import { dateServiceProvider } from "../services/date"
import { iamServiceProvider } from "../services/iam"

/* import utils */
import * as listUtils from "../utils/lists"
import * as objectUtils from "../utils/objects"
import * as UnicornUtils from "../utils/unicorns"

const { winston } = UnicornUtils

/* import types */
import * as Iam from "../types/iam"
import * as Dynamo from "../types/dynamodb"
import * as Misc from "../types/misc"
import * as Api from "../types/api"

/* ensure the dynamo table is in the correct region */
aws.config.update({ region: "us-east-1" })

/* define error constants */
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`

/* setup dynamodb client */
const dynamodb = new aws.DynamoDB.DocumentClient()

/* define the handler */
export const handler = async (event?: Misc.AppsyncEvent<Iam.ClientLogin>) => {
  /* // TODO: initialize services in separate file */
  const date = dateServiceProvider()
  const iamService = iamServiceProvider({ iam: jwt })
  const dynamoService = dynamoServiceProvider({ dynamodb, date })

  if (!objectUtils.objectIsEmpty(event) && event?.arguments.input) {
    /* extract credentials provided by the client */
    const {
      username: clientUsername,
      password: clientPassword,
    } = event?.arguments.input

    /* first query by username */
    const user = await dynamoService.findUser(clientUsername)

    /* define message to display on username or password failure */
    const genericErrorMessage = "Incorrect username or password."

    /* if the user was not found, throw generic error message */
    if (objectUtils.objectIsEmpty(user)) {
      throw new Error(genericErrorMessage)
    }

    /* extract the hashed password */
    const { password: hashedPassword, uuid, username, favoriteStops } = user

    /* verify that the user provided the correct password */
    const passwordsMatch = await bcrypt.compare(clientPassword, hashedPassword)

    /* throw an error if the passwords don't match */
    if (!passwordsMatch) {
      throw new Error("Invalid credentials.")
    }

    /* create the payload for the jwt */
    const payload = { uuid, username, email: user.email }

    /* create an access token */
    const accessToken = iamService.generateToken(payload)

    // login was successful
    return { accessToken, user }
  }

  throw new Error("Server error.")
}
