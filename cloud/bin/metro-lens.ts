#!/usr/bin/env node
import chalk from 'chalk'
import * as path from 'path'
import * as dotenv from 'dotenv'
import * as cdk from '@aws-cdk/core'
import * as time from 'date-fns'
import { MetroLensStack } from '../lib/metro-lens-stack'

const STAGE = 'stage'
const ENVIRONMENTS = ['atlantic', 'pacific'] as const

/* should be relative to where it will be used, e.g. lib/metro-lens-stack.ts */
const UI_DIRECTORY = '../client/build'
const SCHEMA_DIRECTORY = 'graphql/schema.graphql'

type Environments = typeof ENVIRONMENTS[number]

const configEnvironment = (environment: Environments) => {
  const parentDirectory = path.resolve(__dirname, '..')
  if (ENVIRONMENTS.includes(environment)) {
    dotenv.config({
      path: `${parentDirectory}/staging/.env.${environment}`,
    })
  }
}

export const getEnvironmentVariables = () => {
  /* single source of truth for the app name */
  const appName = 'metro-lens'

  /* single source of truth for types and test prop values */
  return {
    appName,
    email: process.env.EMAIL!,
    uiDirectory: UI_DIRECTORY,
    schemaDirectory: SCHEMA_DIRECTORY,
    environmentName: process.env.ENV_NAME!,
    resourcePrefix: `${process.env.ENV_NAME!}-${appName}`,
    certificateArn: process.env.ACM_CERTIFICATE_ARN!,
    hostedZoneId: process.env.HOSTED_ZONE_ID!,
    hostedZoneName: process.env.HOSTED_ZONE_NAME!,
    aliasRecordName: process.env.DOMAIN_ALIAS_NAME!,
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT!,
      region: process.env.CDK_DEFAULT_REGION!,
    },
  }
}

const synth = async (): Promise<number> => {
  /* initialize the app */
  const app = new cdk.App({ autoSynth: false })

  /* the node variable contains the context free */
  const stagingEnvironment: Environments =
    app.node.tryGetContext(STAGE) || 'atlantic'

  if (stagingEnvironment) {
    configEnvironment(stagingEnvironment)
  } else {
    const message = chalk.bold.black.bgRed.inverse(
      'Error during cdk synth: No Staging variable provided.'
    )
    console.error(message)
    return process.exit(1)
  }

  const props = getEnvironmentVariables()

  console.log({ typeof: typeof MetroLensStack })

  /* initialize the stack */
  new MetroLensStack(app, 'MetroLensStack', props)

  /* create the cloudformation template in cdk.out */
  app.synth()

  /* return a number */
  return 0
}

/* handle failure to create cloudformation */
synth()
  .then(() => {
    const now = time.format(new Date(), 'hh:mmaaaaa')
    const timestamp = chalk.bold.green(`[${now}m]:`)
    console.log(`${timestamp} Finished deployment.`)
  })
  .catch((error: Error) => {
    console.error(
      chalk.bold.black.bgRed.inverse('Error during cdk synth:', error),
      chalk.bold.black.bgRed.inverse(
        '. If this error persists after cdk synth, try yarn build. The js files might be outdated.'
      )
    )
    return console.error(error)
  })
