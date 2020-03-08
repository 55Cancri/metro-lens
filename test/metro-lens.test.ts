import {
  expect as expectCDK,
  haveResource,
  SynthUtils
} from './node_modules/@aws-cdk/assert'
import * as cdk from './node_modules/@aws-cdk/core'
import * as path from 'path'
import * as dotenv from './node_modules/dotenv'
import './node_modules/jest-cdk-snapshot'

import { MetroLensStack } from '../lib/metro-lens-stack'

/* define the path to the environment file */
const toConfig = path.resolve(__dirname, '../staging') + '/.env.atlantic'

/* read the file in */
dotenv.config({ path: toConfig })

const appName = 'metro-lens'
const UI_DIRECTORY = 'client/build'

/* define the stack props */
const props = {
  appName,
  uiDirectory: UI_DIRECTORY,
  environmentName: process.env.ENV_NAME!,
  resourcePrefix: `${process.env.ENV_NAME!}-${appName}`,
  hostedZoneId: process.env.HOSTED_ZONE_ID!,
  hostedZoneName: process.env.HOSTED_ZONE_NAME!,
  certificateArn: process.env.ACM_CERTIFICATE_ARN!,
  aliasRecordName: process.env.UI_DOMAIN_ALIAS!,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
}

test('S3 Bucket Created', () => {
  const app = new cdk.App()
  // WHEN
  const stack = new MetroLensStack(app, 'MyTestStack', props)
  // THEN
  expect(stack).toMatchCdkSnapshot()
})

test('CloudFront Created', () => {
  const app = new cdk.App()
  // WHEN
  const stack = new MetroLensStack(app, 'MyTestStack', props)
  // THEN
  expect(stack).toMatchCdkSnapshot()
})

// test('SQS Queue Created', () => {
//     const app = new cdk.App();
//     // WHEN
//     const stack = new MetroLens.MetroLensStack(app, 'MyTestStack');
//     // THEN
//     expectCDK(stack).to(haveResource("AWS::SQS::Queue",{
//       VisibilityTimeout: 300
//     }));
// });

// test('SNS Topic Created', () => {
//   const app = new cdk.App();
//   // WHEN
//   const stack = new MetroLens.MetroLensStack(app, 'MyTestStack');
//   // THEN
//   expectCDK(stack).to(haveResource("AWS::SNS::Topic"));
// });
