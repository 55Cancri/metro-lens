import * as cdkAssert from '@aws-cdk/assert'
// import { expect, haveResource, SynthUtils } from '@aws-cdk/assert'
import * as cdk from '@aws-cdk/core'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { MetroLensStack } from '../lib/metro-lens-stack'

/* define the path to the environment file */
const toConfig = path.resolve(__dirname, '../staging') + '/.env.atlantic'

/* read the file in */
dotenv.config({ path: toConfig })

/* should be loaded after dotenv has read the environment variables */
import { props, appName } from '../bin/metro-lens'

const UI_DIRECTORY = '../client/build'
const SCHEMA_DIRECTORY = './graphql/schema.graphql'

/* define the stack props */
// const props = {
//   appName,
//   email: process.env.EMAIL!,
//   uiDirectory: UI_DIRECTORY,
//   schemaDirectory: SCHEMA_DIRECTORY,
//   environmentName: process.env.ENV_NAME!,
//   resourcePrefix: `${process.env.ENV_NAME!}-${appName}`,
//   hostedZoneId: process.env.HOSTED_ZONE_ID!,
//   hostedZoneName: process.env.HOSTED_ZONE_NAME!,
//   certificateArn: process.env.ACM_CERTIFICATE_ARN!,
//   aliasRecordName: process.env.DOMAIN_ALIAS_NAME!,
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: process.env.CDK_DEFAULT_REGION,
//   },
// }

test('S3 bucket created', () => {
  /* create app */
  const app = new cdk.App()

  /* create stack */
  const stack = new MetroLensStack(app, 'MyTestStack', props)

  /* make assertion */
  cdkAssert.expect(stack).to(
    cdkAssert.haveResource('AWS::S3::Bucket', {
      BucketName: 'atlantic-metro-lens-client',
    })
  )
})

test('Lambda function created', () => {
  /* create app */
  const app = new cdk.App()

  /* create stack */
  const stack = new MetroLensStack(app, 'MyTestStack', props)

  /* make assertion */
  cdkAssert.expect(stack).to(cdkAssert.haveResource('AWS::Lambda::Function'))
})

test('CloudFront created', () => {
  /* create app */
  const app = new cdk.App()

  /* create stack */
  const stack = new MetroLensStack(app, 'MyTestStack', props)

  /* make assertion */
  cdkAssert
    .expect(stack)
    .to(cdkAssert.haveResource('AWS::CloudFront::Distribution'))
})

test('CloudFront OAI user created', () => {
  /* create app */
  const app = new cdk.App()

  /* create stack */
  const stack = new MetroLensStack(app, 'MyTestStack', props)

  /* make assertion */
  cdkAssert.expect(stack).to(
    cdkAssert.haveResource('AWS::CloudFront::CloudFrontOriginAccessIdentity', {
      CloudFrontOriginAccessIdentityConfig: {
        Comment: 'Necessary for CloudFront to gain access to the bucket.',
      },
    })
  )
})

test('Route 53 record set created', () => {
  /* create app */
  const app = new cdk.App()

  /* create stack */
  const stack = new MetroLensStack(app, 'MyTestStack', props)

  /* make assertion */
  cdkAssert.expect(stack).to(cdkAssert.haveResource('AWS::Route53::RecordSet'))
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
