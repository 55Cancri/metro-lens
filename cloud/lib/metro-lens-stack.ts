import path from 'path'
import * as cdk from '@aws-cdk/core'
import * as s3 from '@aws-cdk/aws-s3'
import * as sqs from '@aws-cdk/aws-sqs'
import * as sns from '@aws-cdk/aws-sns'
import * as subscriptions from '@aws-cdk/aws-sns-subscriptions'
import * as s3Deployment from '@aws-cdk/aws-s3-deployment'
import * as dynamodb from '@aws-cdk/aws-dynamodb'
import * as lambda from '@aws-cdk/aws-lambda'
import * as nodejs from '@aws-cdk/aws-lambda-nodejs'
import * as appsync from '@aws-cdk/aws-appsync'
import * as cloudwatch from '@aws-cdk/aws-cloudwatch'
import * as cloudwatchActions from '@aws-cdk/aws-cloudwatch-actions'
import * as cloudfront from '@aws-cdk/aws-cloudfront'
import * as events from '@aws-cdk/aws-events'
import * as targets from '@aws-cdk/aws-events-targets'
import * as route53 from '@aws-cdk/aws-route53'
import * as alias from '@aws-cdk/aws-route53-targets'
import * as acm from '@aws-cdk/aws-certificatemanager'
import * as dotenv from 'dotenv'

import { getEnvironmentVariables } from '../bin/get-env-vars'

/* setup dotenv to read environment variables */
dotenv.config()

/* define the props based on the environment variables */
const props = getEnvironmentVariables()

type StackProps = cdk.StackProps & typeof props

export class MetroLensStack extends cdk.Stack {
  /**
   * SOME NOTES:
   * - Passing `this` to each construct scopes the construct to the stack
   * - A domain name must be purchased beforehand, preferably via route 53
   * - A hosted zone and record must be manually created for your domain name
   * - An ACM certificate must be manually created for your domain name
   * - The certificate ARN must be copied as an environment variable
   * - In constructs of the form (scope: cdk.App, id: string, props?: StackProps), id is the construct id and only needs to be unique within the scope in which it is created. The identifier serves as a namespace for everything that's encapsulated within the scope's subtree and is used to allocate unique identities such as resource names and AWS CloudFormation logical IDs. The CDK uses this identity to calculate the CloudFormation Logical ID for each resource defined within this scope.
   */
  constructor(scope: cdk.App, id: string, props?: StackProps) {
    super(scope, id, props)

    /* source the ui files */
    const s3Source = s3Deployment.Source.asset(props?.uiDirectory!)

    /* define the bucket name */
    const bucketName = props?.resourcePrefix + '-client'

    /* create the s3 bucket */
    const bucket = this.createBucket(bucketName)

    /* create the cloudfront distribution */
    const distribution = this.createCloudFront(props!, bucket, id)

    /* put the ui in s3 bucket and allow cloudfront to access the bucket */
    this.deploySourceToBucket(bucket, s3Source, distribution)

    /* update the route 53 */
    const hostedZone = this.updateRoute53(
      distribution,
      props?.hostedZoneName!,
      props?.hostedZoneId!
    )

    /* create dynamodb table */
    const metrolensTable = new dynamodb.Table(this, 'metrolens-table', {
      tableName: 'metro',
      partitionKey: { name: 'entity', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    /* create dynamodb history table */
    const metrolensHistTable = new dynamodb.Table(
      this,
      'metrolens-hist-table',
      {
        tableName: 'metro-hist',
        partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'archiveTime', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PROVISIONED,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    )

    /* create appsync to interface with lambdas and dynamodb */
    const graphql = new appsync.GraphQLApi(this, 'GraphQLApi', {
      name: 'metrolens-graphql-api',
      logConfig: {
        /* log every resolver */
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },

      // authorizationConfig: {
      //   defaultAuthorization: {
      //     // TODO: add another field
      //     // userPool,
      //     defaultAction: appsync.UserPoolDefaultAction.ALLOW
      //   },
      //   additionalAuthorizationModes: [
      //     {
      //       apiKeyDesc: 'My API Key'
      //     }
      //   ]
      // },
      schemaDefinitionFile: props?.schemaDirectory,
    })

    /* appsync: create lambda */
    const appsyncLambda = new lambda.Function(this, 'appsyncTestLambda', {
      code: lambda.Code.fromInline(
        'exports.handler = (event, context) => { console.log(event); context.succeed(event); }'
      ),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
    })

    /* appsync: add lambda */
    const lambdaDataSource = graphql.addLambdaDataSource(
      'appsyncLambda',
      'Lambda triggered by appsync',
      appsyncLambda
    )

    lambdaDataSource.createResolver({
      typeName: 'Query',
      fieldName: 'getUsers',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    })

    lambdaDataSource.createResolver({
      typeName: 'Query',
      fieldName: 'getUser',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    })

    const layer = new lambda.LayerVersion(this, 'CommonLayer', {
      /**
       * lambda.Code.fromAsset(path) specifies a directory or a .zip
       * file in the local filesystem which will be zipped and uploaded
       * to S3 before deployment.
       * Note: import the ./layers, not ./layers/nodejs. "nodejs" must be
       * the top-level directory.
       * https://medium.com/@anjanava.biswas/nodejs-runtime-environment-with-aws-lambda-layers-f3914613e20e
       * */
      code: lambda.Code.fromAsset(path.join(__dirname, '../layers')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_12_X],
      description: 'Layer for Metro Lens lambdas.',
    })

    /* create lambda to make api bus calls every minute */
    // const lambdaScribe = new lambda.Function(this, 'scribe', {
    const lambdaScribe = new nodejs.NodejsFunction(this, 'scribe', {
      functionName: 'scribe',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.seconds(90),
      /* code loaded from dist directory */
      entry: './lambda/scribe/scribe-0.ts',
      // code: lambda.Code.fromAsset('lambda/dist'),
      /* file is metro-polling, function is handler */
      handler: 'handler',
      // handler: 'metro-polling.handler',
      /* include reuseable node modles */
      layers: [layer],
      description:
        'Call the wmata and fairfax connector apis to get the latest predictions, then invoke an appsync mutation to push the new values to the client subscribers and save the values to the database.',
      environment: {
        SORT_KEY: 'id',
        HIST_SORT_KEY: 'archiveTime',
        PARTITION_KEY: 'entity',
        HIST_PARTITION_KEY: 'id',
        TABLE_NAME: metrolensTable.tableName,
        HIST_TABLE_NAME: metrolensHistTable.tableName,
        CONNECTOR_KEY: process.env.CONNECTOR_KEY!,
        WMATA_KEY: process.env.WMATA_KEY!,
      },
    })

    /* create a cloudwatch target from the lambda */
    const scribeTarget = new targets.LambdaFunction(lambdaScribe)

    /* create cloudwatch 1 minute interval trigger for lambda */
    new events.Rule(this, 'scribeSchedule', {
      description:
        'Call a lambda to poll wmata and fairfax connector apis to get the latest bus and rail predictions. The lambda will trigger an appsync mutation and save the latest data to dynamodb.',
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      /* attach the lambda to the schedule */
      targets: [scribeTarget],
    })

    const lambdaAuditor = new nodejs.NodejsFunction(this, 'auditor', {
      functionName: 'auditor',
      runtime: lambda.Runtime.NODEJS_12_X,
      /* code loaded from dist directory */
      entry: './lambda/auditor/auditor-0.ts',
      // code: lambda.Code.fromAsset('lambda/auditor'),
      /* file is auditor.ts, function is handler */
      handler: 'handler',
      /* include reuseable node modles */
      layers: [layer],
      timeout: cdk.Duration.seconds(120),
      description: 'Ensure all vehicle ids are present in the database.',
      environment: {
        SORT_KEY: 'id',
        PARTITION_KEY: 'entity',
        HIST_PARTITION_KEY: 'id',
        HIST_SORT_KEY: 'archiveTime',
        TABLE_NAME: metrolensTable.tableName,
        HIST_TABLE_NAME: metrolensHistTable.tableName,
        CONNECTOR_KEY: process.env.CONNECTOR_KEY!,
        WMATA_KEY: process.env.WMATA_KEY!,
      },
    })

    /* create a cloudwatch target from the lambda */
    const auditorTarget = new targets.LambdaFunction(lambdaAuditor)

    /* create cloudwatch 1 minute interval trigger for lambda */
    new events.Rule(this, 'auditorSchedule', {
      description:
        'Call the auditor lambda to make sure all vehicle ids are accounted for.',
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      /* attach the lambda to the schedule */
      targets: [auditorTarget],
    })

    /* grant the lambdas access to the dynamodb table */
    metrolensTable.grantReadWriteData(lambdaAuditor)
    metrolensTable.grantReadWriteData(lambdaScribe)

    /* grant the lambdas access to the dynamodb hist table */
    metrolensHistTable.grantWriteData(lambdaAuditor)
    metrolensHistTable.grantWriteData(lambdaScribe)

    /* create a new topic for lambda errors */
    const lambdaErrorTopic = new sns.Topic(this, 'LambdaErrorTopic', {
      topicName: 'lambda-error-topic',
    })

    /**
     * The most important properties to set while creating an Alarms are:
     *
     * threshold: the value to compare the metric against.
     *
     * comparisonOperator: the comparison operation to use, defaults to metric >= threshold.
     *
     * evaluationPeriods: how many consecutive periods the metric has to be breaching the the
     * threshold for the alarm to trigger.
     */
    const auditorLambdaErrorAlarm = new cloudwatch.Alarm(
      this,
      'AuditorLambdaErrorAlarm',
      {
        alarmName: 'auditor-lambda-error-alarm',
        alarmDescription: 'Alarm for errors from the auditor lambda.',
        /* create the alarm using the lambda */
        metric: lambdaAuditor.metricErrors({
          period: cdk.Duration.minutes(1),
        }),
        threshold: 1,
        /* trigger the alarm after crossing the threshold once (1 error is recorded) */
        evaluationPeriods: 1,
      }
    )

    /**
     * The most important properties to set while creating an Alarms are:
     *
     * threshold: the value to compare the metric against.
     *
     * comparisonOperator: the comparison operation to use, defaults to metric >= threshold.
     *
     * evaluationPeriods: how many consecutive periods the metric has to be breaching the the
     * threshold for the alarm to trigger.
     */
    const scribeLambdaErrorAlarm = new cloudwatch.Alarm(
      this,
      'ScribeLambdaErrorAlarm',
      {
        alarmName: 'scribe-lambda-error-alarm',
        alarmDescription: 'Alarm for errors from the scribe lambda.',
        /* create the alarm using the lambda */
        metric: lambdaScribe.metricErrors({
          period: cdk.Duration.minutes(1),
        }),
        threshold: 1,
        /* trigger the alarm after crossing the threshold once (1 error is recorded) */
        evaluationPeriods: 1,
      }
    )

    /* [pull] subscribe by email to the lambda error topic */
    lambdaErrorTopic.addSubscription(
      new subscriptions.EmailSubscription(props?.email!)
    )

    /* [push] send an sns message to the topic when the auditor lambda alarm goes off */
    auditorLambdaErrorAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(lambdaErrorTopic)
    )

    /* [push] send an sns message to the topic when the scribe lambda alarm goes off */
    scribeLambdaErrorAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(lambdaErrorTopic)
    )

    // create queue to send sms message to my phone
    // const queue = new sqs.Queue(this, 'MetroLensQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // })

    // create to be subscribed to
    // const topic = new sns.Topic(this, 'MetroLensTopic')

    // topic.addSubscription(new subs.SqsSubscription(queue))
  }

  private helpers = {
    s3: {
      getErrorConfig: (
        errorCode: number
      ): cloudfront.CfnDistribution.CustomErrorResponseProperty => ({
        errorCode,
        responseCode: 200,
        responsePagePath: '/index.html',
        errorCachingMinTtl: 300,
      }),
    },
    cloudfront: {
      /* get the certificate from aws by its arn, then attach to cloudfront */
      getAcmCertificate: (certificateArn: string, id: string) =>
        acm.Certificate.fromCertificateArn(this, id, certificateArn),
      /* create the final certificate to attach to the cloudfront */
      getViewerCertificate: (
        certificate: acm.ICertificate,
        domainNames: string[]
      ) =>
        cloudfront.ViewerCertificate.fromAcmCertificate(certificate, {
          aliases: domainNames,
          /* define the method (SSL protocol) by which cloudfront encrypts traffic over HTTPS connections */
          securityPolicy: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2018,
          // default, CloudFront can use SNI to host multiple distributions on the same IP - which a large majority of clients will support.
          sslMethod: cloudfront.SSLMethod.SNI,
        }),
      /* An Origin Access Identity is a virtual CloudFront user that is used to gain access to private content from your S3 bucket. Without this, cloudfront is like an anonymous user. Note that even though an OAI user is an IAM subject that can be referenced in a resource policy, it does not create a full-fledged IAM user, so you don't see it in IAM and cannot attach policies to it directly. Also note that currently, OAI only works for S3 bucket origins. */
      getOriginIdentityAccessUser: () => {
        /* The function will request an OAI user and a ref will be returned to it. */
        const cloudFrontOaiRef = new cloudfront.CfnCloudFrontOriginAccessIdentity(
          this,
          'OAI',
          {
            cloudFrontOriginAccessIdentityConfig: {
              comment: `Necessary for CloudFront to gain access to the bucket.`,
            },
          }
        )

        /* The actual OAI user can then be created below when the ref above is passed as a parameter. */
        return cloudfront.OriginAccessIdentity.fromOriginAccessIdentityName(
          this,
          'OAIImported',
          cloudFrontOaiRef.ref
        )
      },
    },
  }

  private createBucket = (bucketName: string) =>
    new s3.Bucket(this, bucketName, {
      bucketName,
      /* redirect success requests to index.html */
      websiteIndexDocument: 'index.html',
      /* redirect error requests to index.html */
      websiteErrorDocument: 'index.html',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      /* completely destroy bucket during cdk destroy */
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      /* only cloudfront can read the bucket */
      publicReadAccess: false,
      /* upload a new file on each upload */
      versioned: false,
    })

  private deploySourceToBucket = (
    bucket: s3.Bucket,
    uiSource: s3Deployment.ISource,
    distribution: cloudfront.IDistribution
  ) =>
    new s3Deployment.BucketDeployment(this, `BucketDeployment`, {
      sources: [uiSource],
      destinationBucket: bucket,

      /* the file paths to invalidate in the CloudFront distribution */
      distributionPaths: ['/*'],
      /* the CloudFront distribution that has sole access to the bucket */
      distribution,
      retainOnDelete: false,
    })

  /* The cloudfront fronts the S3 bucket. It also needs to invalidate the Cloudfront cache when new files are uploaded to the S3 bucket. */
  private createCloudFront = (
    props: StackProps,
    bucket: s3.Bucket,
    id: string
  ) => {
    /* extract the domain names and certificate arn from the props */
    const { aliasRecordName, certificateArn } = props

    /* define an array of the domain names */
    const domainNames = [aliasRecordName, 'www.' + aliasRecordName]

    /* create an OAI user */
    const oaiUser = this.helpers.cloudfront.getOriginIdentityAccessUser()

    /* source the certificate that was manually generated in ACM. Ensure all the regions match. */
    const acmCertificate = this.helpers.cloudfront.getAcmCertificate(
      certificateArn,
      id
    )

    /* Use the acm certificate to further specify the domain alias (metro-lens.com) and the method of SSL traffic encryption used over HTTPS. If you were using the default cloudformation certificate, the alias would have had to have been specified directly on the cloudfront, but since you have a third-party certificate (ACM), they must be specified directly on the certificate itself. */
    const viewerCertificate = this.helpers.cloudfront.getViewerCertificate(
      acmCertificate,
      domainNames
    )

    /* redirect back to the index.html file for 403 and 404 errors */
    const errorConfig403 = this.helpers.s3.getErrorConfig(403)
    const errorConfig404 = this.helpers.s3.getErrorConfig(404)

    /* create the cloudformation */
    return new cloudfront.CloudFrontWebDistribution(this, 'CloudFront', {
      comment: 'The cloudfront distribution for metro-lens.com.',
      originConfigs: [
        {
          s3OriginSource: {
            /* specify the bucket that the cloudfront will read from  */
            s3BucketSource: bucket,
            /* attach the OAI user to the cloudfront so that it can access the s3 bucket contents */
            originAccessIdentity: oaiUser,
          },
          behaviors: [{ isDefaultBehavior: true }],
        },
      ],
      /* attach to the certificate to the cloudfront */
      viewerCertificate,
      /* defaults to HTTP or HTTPS, instead set to HTTPS always */
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      /* redirect all errors back to the react page */
      errorConfigurations: [errorConfig403, errorConfig404],
      /* The default object to serve. Not sure what would happen without this. */
      defaultRootObject: 'index.html',
    })
  }

  private updateRoute53 = (
    distribution: cloudfront.CloudFrontWebDistribution,
    hostedZoneName: string,
    hostedZoneId: string
  ) => {
    // TODO: add environment prefix to route 53 domain names. Already happening for s3 bucket and cloudfront.
    /* // *Original - find the hosted zone that was manually created after purchasing a domain name from the wizard */
    // const zone = route53.HostedZone.fromLookup(this, hostedZoneId, {
    //   domainName: hostedZoneName,
    // })

    /* // *Original - get a reference to the cloudfront domain */
    // const target = route53.RecordTarget.fromAlias(
    //   new alias.CloudFrontTarget(distribution)
    // )

    // TODO: get working in the future
    // /* route requests from the custom domain in route 53 (metro-lens.com) to cloudfront */
    // return new route53.ARecord(this, 'BaseAliasRecord', {
    //   recordName: 'metro-lens.com.',
    //   zone,
    //   target,
    // })

    // TODO: get working in the future
    // /* route requests from the custom domain in route 53 (metro-lens.com) to cloudfront */
    // return new route53.ARecord(this, 'CommonAliasRecord', {
    //   recordName: 'www.metro-lens.com.',
    //   zone,
    //   target,
    // })

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      'zone',
      { hostedZoneId, zoneName: hostedZoneName }
    )

    new route53.ARecord(this, 'baseARecord', {
      zone: hostedZone,
      recordName: 'metro-lens.com.',
      target: route53.RecordTarget.fromAlias(
        new alias.CloudFrontTarget(distribution)
      ),
    })

    new route53.ARecord(this, 'wwwARecord', {
      zone: hostedZone,
      recordName: 'www.metro-lens.com.',
      target: route53.RecordTarget.fromAlias(
        new alias.CloudFrontTarget(distribution)
      ),
    })

    /* // *Original - route requests from the custom domain in route 53 (metro-lens.com) to cloudfront */
    // return new route53.ARecord(this, 'AliasRecord', {
    //   zone,
    //   target,
    // })
  }
}
