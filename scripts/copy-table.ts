import aws from 'aws-sdk'
import * as df from 'date-fns'
import util from 'util'
const region = 'us-east-1'

// use dev nonprod account
const profile = 'default'

// set credentials
const credentials = new aws.SharedIniFileCredentials({ profile })
aws.config.update({ region })

// enable promises
aws.config.credentials = credentials

// create dynamo instance
const dynamoDb = new aws.DynamoDB.DocumentClient()

// define the table name
const TableName = 'metro'
const HistTableName = 'metro-hist'

type PrimaryKey = Record<'entity' | 'id', string>

/* -------------------------------------------------------------------------- */
/*                              Helper functions                              */
/* -------------------------------------------------------------------------- */

// sleep for x milliseconds
export const sleep = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000))

// chunk array
const chunk = <T>(arr: T[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  )

/* -------------------------------------------------------------------------- */
/*                              dynamodb requests                             */
/* -------------------------------------------------------------------------- */

// wrap an object in a DeleteRequest object
const toPutRequest = <T>(Item: T) => ({
  PutRequest: { Item },
})

// wrap an object in a DeleteRequest object
const toDeleteRequest = (Key: Record<string, unknown>) => ({
  DeleteRequest: { Key },
})

/* -------------------------------------------------------------------------- */
/*                          dynamodb batch operations                         */
/* -------------------------------------------------------------------------- */

const putItems = async <T>(batchOf25Items: T[]) => {
  // const requests = batchOf25Items.map((item) => {
  //   return { ...item, entity: 'api_count_history' }
  // }) as aws.DynamoDB.WriteRequest[]

  const requests = batchOf25Items as aws.DynamoDB.WriteRequest[]

  /* define the params of the dynamoDB call */
  const putParams = { RequestItems: { [HistTableName]: requests } }

  /* call the batch write to save the items to the table */
  return dynamoDb.batchWrite(putParams).promise()
}

const deleteItems = async (batchOf25Items: PrimaryKey[]) => {
  const items = batchOf25Items.map(({ entity, id }) => {
    // define the key
    const PrimaryKey = { entity, id }

    // return the proper structure
    const Key = toDeleteRequest(PrimaryKey)

    // attach the table name
    return Key
  })

  const deleteParams = { RequestItems: { [TableName]: items } }

  // final step: delete the items from dynamodb
  return dynamoDb.batchWrite(deleteParams).promise()
}

// determine if the key
const inspectKey = (key: PrimaryKey | undefined) =>
  typeof key !== 'undefined' && !!key.entity && !!key.id

/* -------------------------------------------------------------------------- */
/*                                Main function                               */
/* -------------------------------------------------------------------------- */

// run the main function
const run = async (lastKey?: PrimaryKey): Promise<any> => {
  // check if the previous key exists
  const hasPreviousKey = inspectKey(<PrimaryKey>lastKey)

  // define the exclusive start key
  const startKey = hasPreviousKey ? { ExclusiveStartKey: lastKey } : {}

  // define the params object
  const Params = {
    TableName,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': 'entity' },
    ExpressionAttributeValues: { ':pk': 'api_counter' },
    ...startKey,
  }

  // scan for the table, filtering on a doc type of initial invoice
  const results = await dynamoDb.query(Params).promise()

  // extract the items and the last key from the index query
  const { Items, LastEvaluatedKey } = results

  // log outcome
  if (LastEvaluatedKey) {
    console.log('LastEvaluatedKey: ' + JSON.stringify(LastEvaluatedKey))
    console.log(`Successfully deleted ${Items?.length} items.`)
  } else {
    console.log('No LastEvaluatedKey.')
    console.log(`Successfully deleted ${Items?.length} items.`)
  }

  // create a list of the org id event ids
  const queriedItems = Items?.map(({ entity, id, ...rest }) => {
    const TTL = Math.round(df.addYears(new Date(), 1).getTime() / 1000)
    return { ...rest, id: 'api_count_history', archiveTime: id, TTL }
  }).map(toPutRequest)
  // const queriedItems = Items.map as PrimaryKey[]

  // chunk the the payloads,
  const chunkedRequests = chunk(queriedItems!, 25)

  console.log({ queriedItems: queriedItems?.slice(0, 2) })

  // save the api counts to the hist table
  await Promise.all(chunkedRequests.map(putItems))

  // determine if there is a new last evaluated key
  const hasNewKey = inspectKey(<PrimaryKey>LastEvaluatedKey)

  // if the last evaluated key exists,
  if (hasNewKey) {
    await sleep(3)

    // recursively run the function
    return run(<PrimaryKey>LastEvaluatedKey)
  }
}

// execute program and catch errors
run()
  .then(() => console.log('Done.'))
  .catch((error: Error) => console.error(error))
