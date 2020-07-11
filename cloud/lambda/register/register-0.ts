/* register-0 is always the most recent version */
import * as aws from "aws-sdk"
import * as bcrypt from "bcryptjs"
import { v4 as uuidv4 } from "uuid"
import * as jwt from "jsonwebtoken"

/* import services */
import { apiServiceProvider } from "../services/api-1"
import { iamServiceProvider } from "../services/iam"
import { dynamoServiceProvider } from "../services/dynamodb-1"
import { dateServiceProvider } from "../services/date"

/* import utils */
import * as objectUtils from "../utils/objects"
import * as arrayUtils from "../utils/lists"
import * as UnicornUtils from "../utils/unicorns"

const { winston } = UnicornUtils

/* import types */
import * as Misc from "../types/misc"
import * as Iam from "../types/iam"
import * as Dynamo from "../types/dynamodb"
import * as Api from "../types/api"

/* ensure the dynamo table is in the correct region */
aws.config.update({ region: "us-east-1" })

/* define error constants */
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`

/* setup dynamodb client */
const dynamodb = new aws.DynamoDB.DocumentClient()

/* define the handler */
export const handler = async (
  event?: Misc.AppsyncEvent<Iam.ClientRegister>
) => {
  /* // TODO: initialize services in separate file */
  const date = dateServiceProvider()
  const iamService = iamServiceProvider({ iam: jwt })
  const dynamoService = dynamoServiceProvider({ dynamodb, date })

  if (!objectUtils.objectIsEmpty(event) && event?.arguments.input) {
    /* extract credentials provided by the client */
    const { username, email, password } = event?.arguments.input

    /* query in parallel by the username and email */
    /* this allows users to enter either email or username */
    const usernameCheck = dynamoService.findUser(username)
    const emailCheck = dynamoService.findUser(email)

    /* resolve parallel queries */
    const [usernameResult, emailResult] = await Promise.all([
      usernameCheck,
      emailCheck,
    ])

    /* if the user was not found by email or username */
    if (
      objectUtils.objectIsEmpty(usernameResult) &&
      objectUtils.objectIsEmpty(emailCheck)
    ) {
      /* timestamp the creation date */
      const now = date.getNowInISO()
      const dateCreated = now
      const lastSignOn = now

      /* define the uuid (not id due to sort key) */
      const uuid = uuidv4()

      /* hash the users pashword with 10 salts */
      const hashedPassword = await bcrypt.hash(password, 10)

      /* define the user object to insert into dynamodb */
      const user = {
        uuid,
        username,
        email,
        password: hashedPassword,
        dateCreated,
        lastSignOn,
      }

      /* save the user and get back addition fields */
      const newUser = await dynamoService.saveUser(user)

      /* generate a jwt access token */
      const accessToken = iamService.generateToken({ uuid })

      /* finally, return the user and access token to client */
      return { user: newUser, accessToken }
    }

    throw new Error("User already exists.")
  }

  throw new Error("Server error.")
}
