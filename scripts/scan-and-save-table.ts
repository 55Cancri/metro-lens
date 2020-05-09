import aws from 'aws-sdk'
import util from 'util'
import { promises as fs } from 'fs'

const region = 'us-east-1'

/* use dev nonprod account */
const profile = 'default'

/* define credentials */
const credentials = new aws.SharedIniFileCredentials({ profile })
aws.config.update({ region })

/* set credentials */
aws.config.credentials = credentials

/* create dynamo instance */
const dynamoDb = new aws.DynamoDB.DocumentClient()

/* define the table name */
const TableName = 'metro'

type PrimaryKey = Record<'entity' | 'id', string>

/* sleep for x milliseconds */
export const sleep = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000))

/* determine if the key */
const inspectKey = (key: PrimaryKey | undefined) =>
  typeof key !== 'undefined' && !!key.entity && !!key.id

/* run the main function */
const run = async (lastKey?: PrimaryKey): Promise<any> => {
  /* check if the previous key exists */
  const hasPreviousKey = inspectKey(<PrimaryKey>lastKey)

  /* define the exclusive start key */
  const startKey = hasPreviousKey ? { ExclusiveStartKey: lastKey } : {}

  /* define the params object */
  const Params = { TableName, Limit: 250, ...startKey }

  /* scan for the table, filtering on a doc type of initial invoice */
  const results = await dynamoDb.scan(Params).promise()

  /* extract the items and the last key from the index query */
  const { Items, LastEvaluatedKey } = results

  await fs.appendFile('./metro-table-data.json', JSON.stringify(Items))

  /* log outcome */
  if (LastEvaluatedKey) {
    console.log('LastEvaluatedKey: ' + JSON.stringify(LastEvaluatedKey))
    console.log(`Successfully deleted ${Items?.length} items.`)
  } else {
    console.log('No LastEvaluatedKey.')
    console.log(`Successfully deleted ${Items?.length} items.`)
  }

  /* determine if there is a new last evaluated key */
  const hasNewKey = inspectKey(<PrimaryKey>LastEvaluatedKey)

  /* if the last evaluated key exists, */
  if (hasNewKey) {
    await sleep(3)

    /* recursively run the function */
    return run(<PrimaryKey>LastEvaluatedKey)
  }
}

/* execute program and catch errors */
run()
  .then(() => console.log('Done.'))
  .catch((error: Error) => console.error(error))
