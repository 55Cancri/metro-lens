import aws from 'aws-sdk'
import util from 'util'
import * as df from 'date-fns'
const region = 'us-east-1'

/* use dev nonprod account */
const profile = 'default'

/* set credentials */
const credentials = new aws.SharedIniFileCredentials({ profile })
aws.config.update({ region })

/* enable promises */
aws.config.credentials = credentials

/* create dynamo instance */
const dynamoDb = new aws.DynamoDB.DocumentClient()

/* define the table name */
const TableName = 'metro-hist'

type PrimaryKey = Record<'id' | 'archiveTime', string>

/* sleep for x milliseconds */
export const sleep = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000))

/* determine if the key */
const inspectKey = (key: PrimaryKey | undefined) =>
  typeof key !== 'undefined' && !!key.id && !!key.archiveTime

/* run the main function */
const run = async (lastKey?: PrimaryKey, prevApiCount = 0): Promise<any> => {
  /* check if the previous key exists */
  const hasPreviousKey = inspectKey(<PrimaryKey>lastKey)

  /* define the exclusive start key */
  const startKey = hasPreviousKey ? { ExclusiveStartKey: lastKey } : {}

  /* define the date range: year-month-date - year-month-(date + 1) */
  const date1 = df.format(new Date(), 'yyyy-MM-dd')
  const date2 = df.format(df.addDays(new Date(), 1), 'yyyy-MM-dd')

  /* define the params object */
  const Params = {
    TableName,
    KeyConditionExpression: '#pk = :pk AND #sk BETWEEN :date1 AND :date2',
    ExpressionAttributeNames: { '#pk': 'id', '#sk': 'archiveTime' },
    ExpressionAttributeValues: {
      ':pk': 'api_count_history',
      ':date1': date1,
      ':date2': date2,
    },
    ...startKey,
  }

  /* query the table for api counts in the date range */
  const results = await dynamoDb.query(Params).promise()

  /* extract the items and the last key from the index query */
  const { Items, LastEvaluatedKey } = results

  /* log outcome */
  if (LastEvaluatedKey) {
    console.log('LastEvaluatedKey: ' + JSON.stringify(LastEvaluatedKey))
    console.log(`Successfully queried ${Items?.length} items.`)
  } else {
    console.log('No LastEvaluatedKey.')
    console.log(`Successfully queried ${Items?.length} items.`)
  }

  /* create a list of the org id event ids */
  const apiCount =
    Items?.reduce((store, { apiCount }) => store + apiCount, 0) ?? 0

  console.log('apiCount:  ' + apiCount)

  /* determine if there is a new last evaluated key */
  const hasNewKey = inspectKey(<PrimaryKey>LastEvaluatedKey)

  /* if the last evaluated key exists, */
  if (hasNewKey) {
    await sleep(3)

    /* recursively run the function */
    return run(<PrimaryKey>LastEvaluatedKey, prevApiCount + apiCount)
  }

  console.log('Total api calls made in date range: ', prevApiCount + apiCount)
}

/* execute program and catch errors */
run()
  .then(() => console.log('Done.'))
  .catch((error: Error) => console.error(error))
