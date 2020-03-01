import * as sns from "@aws-cdk/aws-sns"
import * as subs from "@aws-cdk/aws-sns-subscriptions"
import * as sqs from "@aws-cdk/aws-sqs"
import * as cdk from "@aws-cdk/core"
import * as s3 from "@aws-cdk/aws-s3"
import * as s3Deployment from "@aws-cdk/aws-s3-deployment"
import * as cloudfront from "@aws-cdk/aws-cloudfront"
import * as route53 from "@aws-cdk/aws-route53"
import * as alias from "@aws-cdk/aws-route53-targets"
import * as acm from "@aws-cdk/aws-certificatemanager"

interface StackProps extends cdk.StackProps {
  uiDirectory: string
  environmentName: string
  resourcePrefix: string
  certificateArn: string
  hostedZoneId: string
  hostedZoneName: string
  aliasRecordName: string
}

export class MetroLensStack extends cdk.Stack {
  /**
   * SOME NOTES:
   * - Passing `this` to each construct scopes the construct to the stack
   * - A domain name must be purchased beforehand, preferably via route 53
   * - A hosted zone and record must be manually created for your domain name
   * - An ACM certificate must be manually created for your domain name
   * - The certificate ARN must be copied as an environment variable
   */
  constructor(scope: cdk.App, id: string, props?: StackProps) {
    super(scope, id, props)

    /* source the ui files */
    const source = s3Deployment.Source.asset(props?.uiDirectory!)

    /* define the bucket name */
    const bucketName = props?.resourcePrefix + "-client"

    /* create the s3 bucket */
    const bucket = this.createBucket(bucketName)

    /* create the cloudfront distribution */
    const distribution = this.createCloudFront(props!, bucket, id)

    /* put the ui in s3 bucket and allow cloudfront to access the bucket */
    this.deploySourceToBucket(bucket, source, distribution)

    /* update the route 53 */
    const hostedZone = this.updateRoute53(
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

  private helpers = {
    s3: {
      getErrorConfig: (
        errorCode: number
      ): cloudfront.CfnDistribution.CustomErrorResponseProperty => ({
        errorCode,
        responseCode: 200,
        responsePagePath: "/index.html",
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
          "OAI",
          {
            cloudFrontOriginAccessIdentityConfig: {
              comment: `Necessary for CloudFront to gain access to the bucket.`,
            },
          }
        )

        /* The actual OAI user can then be created below when the ref above is passed as a parameter. */
        return cloudfront.OriginAccessIdentity.fromOriginAccessIdentityName(
          this,
          "OAIImported",
          cloudFrontOaiRef.ref
        )
      },
    },
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
    uiSource: s3Deployment.ISource,
    distribution: cloudfront.IDistribution
  ) =>
    new s3Deployment.BucketDeployment(this, `BucketDeployment`, {
      sources: [uiSource],
      destinationBucket: bucket,
      /* the file paths to invalidate in the CloudFront distribution */
      distributionPaths: ["/*"],
      /* the CloudFront distribution that has sole access to the bucket */
      distribution,
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
    const domainNames = [aliasRecordName]

    /* create an OAI user */
    const oaiUser = this.helpers.cloudfront.getOriginIdentityAccessUser()

    /* source the certificate that was manually generated in ACM */
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
    return new cloudfront.CloudFrontWebDistribution(this, "CloudFront", {
      comment: "The cloudfront distribution for metro-lens.com.",
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
      defaultRootObject: "index.html",
    })
  }

  private updateRoute53 = (
    hostedZoneName: string,
    hostedZoneId: string,
    distribution: cloudfront.CloudFrontWebDistribution
  ) => {
    // TODO: add environment prefix to route 53 domain names. Already happening for s3 bucket and cloudfront.
    /* find the hosted zone that was manually created after purchasing a domain name from the wizard */
    const zone = route53.HostedZone.fromLookup(this, hostedZoneId, {
      domainName: hostedZoneName,
    })

    /* get a reference to the cloudfront domain */
    const target = route53.RecordTarget.fromAlias(
      new alias.CloudFrontTarget(distribution)
    )

    /* route requests from the custom domain in route 53 (metro-lens.com) to cloudfront */
    return new route53.ARecord(this, "AliasRecord", {
      zone,
      target,
    })
  }
}
