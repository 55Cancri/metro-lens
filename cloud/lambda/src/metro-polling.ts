import * as lambda from 'aws-lambda'
console.log('Attempting axios import...')
import axios from 'axios'

export const handler = async (
  event?: lambda.APIGatewayEvent
): Promise<string> => {
  const wmata = await axios.get(
    'https://api.wmata.com/NextBusService.svc/json/jPredictions',
    {
      headers: { api_key: process.env.WMATA_KEY },
      params: { StopID: '5001306' }
    }
  )

  const connector = await axios.get(
    'https://www.fairfaxcounty.gov/bustime/api/v3/getpredictions',
    {
      headers: { 'Content-Type': 'application/json' },
      params: {
        key: process.env.CONNECTOR_KEY,
        format: 'json',
        stpid: '2101,6489,6345,2100,6486,1383,4011'
      }
    }
  )

  console.log(`[${new Date().toLocaleString()}]: Hello World!`)
  console.log(wmata)
  console.log(connector)
  const response = JSON.stringify(event, null, 2)
  return response
}
