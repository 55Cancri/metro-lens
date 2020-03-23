import { promises as fs } from 'fs'
import util from 'util'
import axios from 'axios'

const trace = (item: unknown) => util.inspect(item, false, null, true)

interface Route {
  rt: string
  rtnm: string
}

interface Vehicle {
  vid: string
}

const main = async () => {
  const key = 'knEZ3gqEcF3Y9vgpujB8eCixa'
  const defaultParams = { key, format: 'json' }

  let vehicleCount = 0

  const { data } = await axios.get(
    'https://www.fairfaxcounty.gov/bustime/api/v3/getroutes',
    {
      params: defaultParams
    }
  )

  const { routes } = data['bustime-response']

  let callCount = routes.length + 1

  const getVehicles = async ({ rt, rtnm }: Route) => {
    const { data: rtData } = await axios.get(
      'https://www.fairfaxcounty.gov/bustime/api/v3/getvehicles',
      {
        params: { ...defaultParams, rt }
      }
    )

    const response = rtData['bustime-response']

    if ('vehicle' in response) {
      const { vehicle } = response

      const vehicles = vehicle.map(({ vid }: Vehicle) => vid)

      vehicleCount = vehicleCount + vehicles.length

      return { rt, rtnm, vehicles }
    }

    if ('error' in response) {
      const { error } = response

      const [item] = error

      const { msg } = item

      return { rt, rtnm, error: msg }
    }

    return { rt, rtnm }
  }

  const allVehicles = await Promise.all(routes.map(getVehicles))

  await fs.writeFile(__dirname + '/vehicles3.json', JSON.stringify(allVehicles))

  console.log({ vehicleCount, callCount })
}

const complete = () => console.log('Done.')

const error = (err: Error) => console.error(err)

main()
  .then(complete)
  .catch(error)
