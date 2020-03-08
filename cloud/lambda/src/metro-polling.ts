import * as lambda from 'aws-lambda'

export const handler = async (
  event?: lambda.APIGatewayEvent
): Promise<string> => {
  console.log(`[${new Date().toLocaleString()}]: Hello World!`)
  const response = JSON.stringify(event, null, 2)
  return response
}
