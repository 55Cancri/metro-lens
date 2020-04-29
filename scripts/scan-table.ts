import aws from 'aws-sdk'
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

const run = async () => {
  // define the params object
  const Params = { TableName }

  // scan for the table, filtering on a doc type of initial or district invoice
  const results = await dynamoDb.scan(Params).promise()

  console.log(results.Items?.[0])
}

run()
  .then(() => console.log('Done.'))
  .catch((error) => console.error(error))

// define the document type
// const DocumentType = 'initialInvoice';

// determine if the key
// const inspectKey = (key) => typeof key !== 'undefined' && key.OrgIdEventId;

// recursively scan the entire table
// const scanRun = async (
//   lastKey,
//   meta = { inputsAndInitials: {}, totalScanned: 0 }
// ) => {
//   // define the exclusive start key
//   const startKey = inspectKey(lastKey) ? { ExclusiveStartKey: lastKey } : {};

//   // define the params object
//   const Params = { TableName, ...startKey };

//   // scan for the table, filtering on a doc type of initial or district invoice
//   const results = await dynamoDb.scan(Params).promise();

//   // extract the items and the last key from the index query
//   const { Items, LastEvaluatedKey } = results;

//   const inputsAndInitials = Items.reduce((store, invoice) => {
//     const { OrgIdEventId, DocumentType, PendingOrderCanceled } = invoice;
//     if (PendingOrderCanceled) {
//       return store;
//     }

//     const storedOrgIdEventId = store[OrgIdEventId];

//     const isValidDocumentType =
//       DocumentType === 'Input' || DocumentType === 'initialInvoice';

//     if (!storedOrgIdEventId && isValidDocumentType) {
//       return { ...store, [OrgIdEventId]: 1 };
//     }

//     if (storedOrgIdEventId && isValidDocumentType) {
//       return { ...store, [OrgIdEventId]: storedOrgIdEventId + 1 };
//     }

//     return store;
//   }, meta.inputsAndInitials);

//   // determine if there is a new last evaluated key
//   const hasNewKey = inspectKey(LastEvaluatedKey);

//   // determine the total items scanned
//   const totalScanned = meta.totalScanned + Items.length;

//   // if the last evaluated key exists,
//   if (hasNewKey) {
//     // log outcome
//     console.log('LastEvaluatedKey: ' + LastEvaluatedKey.OrgIdEventId);
//     console.log(
//       `Last items scanned: ${Items.length}.\nTotal items scanned: ${totalScanned}.`
//     );

//     // recursively run the function
//     return scanRun(LastEvaluatedKey, {
//       ...meta,
//       inputsAndInitials,
//       totalScanned
//     });
//   }

//   console.log('No LastEvaluatedKey.');
//   console.log(
//     `Last items scanned: ${Items.length}.
//        Total items scanned: ${totalScanned}.`
//   );

//   const inputsWithInitials = Object.entries(meta.inputsAndInitials).filter(
//     ([k, v]) => v === 2
//   );

//   console.log(inputsWithInitials);
//   console.log(inputsWithInitials.length);
//   console.log('Done.');
// };

// // start timer
// console.time();
// // execute program and catch errors
// scanRun()
//   .then(() => console.timeEnd())
//   .catch((error) => console.error(error));
