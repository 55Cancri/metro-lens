import * as sns from "@aws-cdk/aws-sns"
import * as subs from "@aws-cdk/aws-sns-subscriptions"
import * as sqs from "@aws-cdk/aws-sqs"
import * as cdk from "@aws-cdk/core"
import { Bucket, BlockPublicAccess } from "@aws-cdk/aws-s3"
import { BucketDeployment, Source } from "@aws-cdk/aws-s3-deployment"
import { CloudFrontWebDistribution } from "@aws-cdk/aws-cloudfront"
import { RemovalPolicy } from "@aws-cdk/core"

export class MetroLensStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        // source the spa files
        const source = Source.asset("../client/build")

        // create the s3 bucket
        const bucket = this.createBucket()

        // put spa in s3 bucket
        this.deploySourceToBucket(bucket)

        // create cloudfront
        this.createCloudFront(bucket)

        // create route 53

        // potentially apigateway

        // potentially lambda to handle requests

        // potentially dynamodb if users or metrics should be recorded

        // const queue = new sqs.Queue(this, 'MetroLensQueue', {
        //   visibilityTimeout: cdk.Duration.seconds(300)
        // })

        // const topic = new sns.Topic(this, 'MetroLensTopic')

        // topic.addSubscription(new subs.SqsSubscription(queue))
    }

    private createBucket = () =>
        new Bucket(this, "client", {
            bucketName: "metro-lens-client",
            websiteIndexDocument: "index.html",
            websiteErrorDocument: "index.html",
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            // completely destroy bucket with cdk destroy
            removalPolicy: RemovalPolicy.DESTROY,
            // only cloudfront can read the bucket
            publicReadAccess: false,
            // upload a new file on each upload
            versioned: true,
        })

    private deploySourceToBucket = (bucket: Bucket, source: Source) =>
        new BucketDeployment(this, `BucketDeployment`, {
            sources: [source],
            destinationBucket: bucket,
        })

    private createCloudFront = (bucket: Bucket, hostedZone) => {
        // // ?
        // const domainName = `${subdomain}.${hostedZone.zoneName}`

        // // ?
        // const certificate = new DnsValidatedCertificate(this, 'SiteCertificate', {
        //   region: 'us-east-1',
        //   domainName,
        //   hostedZone
        // })

        // // ?
        // new CfnOutput(this, 'URL', { value: `https://${domainName}/` })

        return new CloudFrontWebDistribution(this, "CloudFront", {
            // ?
            // viewerCertificate: ViewerCertificate.fromAcmCertificate(certificate, {
            //   // ?
            //   aliases: [domainName]
            // }),
            originConfigs: [
                {
                    s3OriginSource: { s3BucketSource: bucket },
                    behaviors: [{ isDefaultBehavior: true }],
                },
            ],
        })
    }
}
