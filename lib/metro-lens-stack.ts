import * as sns from "@aws-cdk/aws-sns"
import * as subs from "@aws-cdk/aws-sns-subscriptions"
import * as sqs from "@aws-cdk/aws-sqs"
import * as cdk from "@aws-cdk/core"
import * as s3 from "@aws-cdk/aws-s3"
import * as s3Deployment from "@aws-cdk/aws-s3-deployment"
import * as cloudfront from "@aws-cdk/aws-cloudfront"
import * as route53 from "@aws-cdk/aws-route53"
import * as alias from "@aws-cdk/aws-route53-targets"

interface StackProps extends cdk.StackProps {
  uiDirectory: string
  environmentName: string
  resourcePrefix: string
  // certificateArn: process.env.ACM_CERTIFCATE_ARN!,
  hostedZoneId: string
  hostedZoneName: string
  aliasRecordName: string
}

export class MetroLensStack extends cdk.Stack {
  // private BUCKET_NAME = "metro-lens-client"

  // private DOMAIN_NAME = "metro-lens.com"

  // private HOSTED_ZONE_NAME = "metro-lens.com."

  // private HOSTED_ZONE_ID = "ZYM0V5BTMV4P1"

  constructor(scope: cdk.App, id: string, props?: StackProps) {
    /**
     * Passing `this` to each construct scopes the construct to the stack
     */
    super(scope, id, props)

    // source the ui files
    const source = s3Deployment.Source.asset(props?.uiDirectory!)

    const bucketName = props?.resourcePrefix + "-client"

    // create the s3 bucket
    const bucket = this.createBucket(bucketName)

    // put ui in s3 bucket
    this.deploySourceToBucket(bucket, source)

    // create cloudfront
    const distribution = this.createCloudFront(bucket)

    // create route 53
    const hostedZone = this.createRoute53(
      props?.hostedZoneName!,
      props?.hostedZoneId!,
      distribution
    )

    // potentially apigateway

    // potentially lambda to handle requests

    // potentially dynamodb if users or metrics should be recorded

    // const queue = new sqs.Queue(this, 'MetroLensQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // })

    // const topic = new sns.Topic(this, 'MetroLensTopic')

    // topic.addSubscription(new subs.SqsSubscription(queue))
  }

  private createEnvironment = (account?: string, region?: string) => {
    // const account = !account ? System.getenv("CDK_DEFAULT_ACCOUNT") : account
    // const region = !region ? System.getenv("CDK_DEFAULT_REGION") : region

    return { account, region }
  }

  private createBucket = (bucketName: string) =>
    new s3.Bucket(this, bucketName, {
      bucketName,
      /* redirect success requests to index.html */
      websiteIndexDocument: "index.html",
      /* redirect error requests to index.html */
      websiteErrorDocument: "index.html",
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      /* completely destroy bucket during cdk destroy */
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      /* only cloudfront can read the bucket */
      publicReadAccess: false,
      /* upload a new file on each upload */
      versioned: true,
    })

  private deploySourceToBucket = (
    bucket: s3.Bucket,
    uiDirectory: s3Deployment.ISource
  ) =>
    new s3Deployment.BucketDeployment(this, `BucketDeployment`, {
      sources: [uiDirectory],
      destinationBucket: bucket,
    })

  /* The cloudfront fronts the S3 bucket. It also needs to invalidate the Cloudfront cache when new files are uploaded to the S3 bucket. */
  private createCloudFront = (bucket: s3.Bucket) => {
    /* A route 53 hosted zone — containing records for the public facing domain and routing information to call the Cloudfront endpoint */
    // const domainName = `${subdomain}.${hostedZone.zoneName}`

    /* And a SSL certificate if we want to serve HTTPS traffic — that is served by the Cloudfront distribution */
    // const certificate = new DnsValidatedCertificate(this, 'SiteCertificate', {
    //   region: 'us-east-1',
    //   domainName,
    //   hostedZone
    // })

    // // ?
    // new CfnOutput(this, 'URL', { value: `https://${domainName}/` })

    return new cloudfront.CloudFrontWebDistribution(this, "CloudFront", {
      // ?
      // viewerCertificate: ViewerCertificate.fromAcmCertificate(certificate, {
      //   // ?
      //   aliases: [domainName]
      // }),
      defaultRootObject: "index.html",
      comment: "The Metro Lens cloudfront.",
      originConfigs: [
        {
          s3OriginSource: { s3BucketSource: bucket },
          behaviors: [{ isDefaultBehavior: true }],
        },
      ],
    })
  }

  private createRoute53 = (
    hostedZoneName: string,
    hostedZoneId: string,
    distribution: cloudfront.CloudFrontWebDistribution
  ) => {
    /* find the hosted zone that was manually created after purchasing a domain name from the wizard */
    const zone = route53.HostedZone.fromLookup(this, hostedZoneId, {
      domainName: hostedZoneName,
    })

    const target = route53.RecordTarget.fromAlias(
      new alias.CloudFrontTarget(distribution)
    )

    return new route53.ARecord(this, "AliasRecord", {
      zone,
      target,
    })
  }
}
