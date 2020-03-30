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

  /* make the getroutes api call */
  const { data } = await axios.get(
    'https://www.fairfaxcounty.gov/bustime/api/v3/getroutes',
    {
      params: defaultParams
    }
  )

  /* extract the array of routes */
  const { routes } = data['bustime-response']

  let callCount = routes.length + 1

  /* for each route, get the associated vehicles */
  const getVehicles = async ({ rt, rtnm }: Route) => {
    /* get the vehicles based on the rt parameter */
    const {
      data: rtData
    } = await axios.get(
      'https://www.fairfaxcounty.gov/bustime/api/v3/getvehicles',
      { params: { ...defaultParams, rt } }
    )

    /* extract the response */
    const response = rtData['bustime-response']

    /* define this moment in time */
    const now = new Date().toISOString()

    /* if call returned vehicles, */
    if ('vehicle' in response) {
      const { vehicle } = response

      const vehicles = vehicle.map(({ vid }: Vehicle) => {
        const lastCheck = now

        const dateCreated = now

        const active = true

        return { vid, active, lastCheck, dateCreated }
      })

      vehicleCount = vehicleCount + vehicles.length

      return { rt, rtnm, vehicles }
    }

    if ('error' in response) {
      const { error } = response

      const [item] = error

      const { msg } = item

      const lastCheck = now

      const dateCreated = now

      const active = false

      return { rt, rtnm, active, lastCheck, dateCreated }
    }

    return { rt, rtnm }
  }

  const allVehicles = await Promise.all(routes.map(getVehicles))

  // await fs.writeFile(__dirname + '/vehicles3.json', JSON.stringify(allVehicles))

  console.log({ vehicleCount, callCount })
}

const complete = () => console.log('Done.')

const error = (err: Error) => console.error(err)

main()
  .then(complete)
  .catch(error)
