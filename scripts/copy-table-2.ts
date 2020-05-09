import aws from 'aws-sdk'
import { copy } from 'copy-dynamodb-table'
import util from 'util'

/* define the cheapest and closest region */
const region = 'us-east-1'

/* use dev nonprod account */
const profile = 'default'

/* define credentials */
const credentials = new aws.SharedIniFileCredentials({ profile })

/* define the table name */
const SourceTableName = 'metro-backup'
const DestinationTableName = 'metro'

/* copy the data from one table to another at 25 intervals */
copy(
  {
    config: { ...credentials, region },
    source: { tableName: SourceTableName },
    destination: { tableName: DestinationTableName },
    log: true, // default false
    create: true, // create destination table if not exist
    schemaOnly: false, // if true it will copy schema only -- optional
  },
  (err, result) => (err ? console.log(err) : console.log(result))
)
