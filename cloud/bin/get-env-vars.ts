const UI_DIRECTORY = '../client/build'
const SCHEMA_DIRECTORY = 'graphql/schema.graphql'

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
