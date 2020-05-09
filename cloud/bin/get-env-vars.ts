const UI_DIRECTORY = '../client/build'
const SCHEMA_DIRECTORY = 'graphql/schema.graphql'

export const getEnvironmentVariables = () => {
  /* single source of truth for the app name */
  const appName = 'metro-lens'

  /* single source of truth for types and test prop values */
  return {
    appName,
    email: String(process.env.EMAIL),
    uiDirectory: UI_DIRECTORY,
    schemaDirectory: SCHEMA_DIRECTORY,
    environmentName: String(process.env.ENV_NAME),
    resourcePrefix: `${String(process.env.ENV_NAME)}-${appName}`,
    certificateArn: String(process.env.ACM_CERTIFICATE_ARN),
    hostedZoneId: String(process.env.HOSTED_ZONE_ID),
    hostedZoneName: String(process.env.HOSTED_ZONE_NAME),
    aliasRecordName: String(process.env.DOMAIN_ALIAS_NAME),
    env: {
      account: String(process.env.CDK_DEFAULT_ACCOUNT),
      region: String(process.env.CDK_DEFAULT_REGION),
    },
  }
}
