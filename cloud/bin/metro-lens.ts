#!/usr/bin/env node
import * as path from 'path'
import * as dotenv from 'dotenv'
import * as cdk from '@aws-cdk/core'
import * as chalk from 'chalk'
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

/* single source of truth for the app name */
export const appName = 'metro-lens'

/* single source of truth for types and test prop values */
export const props = {
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
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
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

  /* initialize the stack */
  new MetroLensStack(app, 'MetroLensStack', props)

  /* create the cloudformation template in cdk.out */
  app.synth()

  /* return a number */
  return 0
}

/* handle failure to create cloudformation */
synth().catch((error: Error) => {
  console.error(
    chalk.bold.black.bgRed.inverse('Error during `cdk synth`:', error)
  )
})
