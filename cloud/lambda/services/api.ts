import * as Api from '../types/api'
import * as Generic from '../types/general'

const URLS = {
  connector: {
    predictions: 'https://www.fairfaxcounty.gov/bustime/api/v3/getpredictions',
    vehicles: 'https://www.fairfaxcounty.gov/bustime/api/v3/getvehicles',
  },
  wmata: { Predictions: '' },
}

const joinById = ({ lists, key }: { lists: any[][]; key: string }): any[] =>
  lists
    .reduce((store, list) => [...store, ...list], [])
    .reduce(
      (store, item) => ({
        ...store,
        [item[key as keyof typeof item]]: {
          ...(store[item[key as keyof typeof item]] || {}),
          ...item,
        },
      }),
      {}
    )

const extractVidFromErrors = (item: Api.ConnectorError) => item.vid

export const apiServiceProvider = ({
  httpClient,
}: Api.ApiServiceProviderProps) => {
  /* make an api call and extract the bustime-response */
  const makeDualApiCalls = async (params: Api.HttpClientConnectorParams) => {
    const connectorUrls = URLS.connector
    const vehiclesPromise = httpClient
      .get(connectorUrls.vehicles, {
        headers: { 'Content-Type': 'application/json' },
        params,
      })
      .then(({ data }) => data['bustime-response'] as Api.ConnectorApiVehicle)

    const predictionsPromise = httpClient
      .get(connectorUrls.predictions, {
        headers: { 'Content-Type': 'application/json' },
        params,
      })
      .then(
        ({ data }) => data['bustime-response'] as Api.ConnectorApiPrediction
      )

    const [vehicles, predictions] = await Promise.all([
      vehiclesPromise,
      predictionsPromise,
    ])

    const errors = [...vehicles.error, ...predictions.error]
    // const errors = [...vehicles.error.map(extractVidFromErrors),
    // ...predictions.error.map(extractVidFromErrors)]

    const vehicleData = [...vehicles.vehicle, ...predictions.prd]

    const mergedData = vehicleData.reduce((store, data) => {
      type StoreKey = keyof typeof store
      const existingBusData = store[data.vid as StoreKey]
      if (existingBusData) {
        return {
          ...store,
          [data.vid]: {
            ...((existingBusData as unknown) as Api.ConnectorPrediction),
            ...data,
          },
        }
      }

      return { ...store, [data.vid]: data }
    }, {} as Api.ConnectorJoin)

    /* convert map of { [vid]: mergedData } to { ...mergedData } */
    const data = (Object.values(mergedData) as unknown) as Api.ConnectorJoin[]

    return { data, errors }
    // const veh = extractProps(vehicles)
    // const prd = extractProps(predictions)

    // const vehicleJoin = joinById({ lists: vehicleInfo, key: 'vid' })

    // return vehicleJoin as Api.ConnectorApiJoin[]
    // const responses = [
    //   ...vehicles,
    //   ...predictions,
    // ] as Api.ConnectorApiResponse[]

    // return responses.reduce(
    //   (store, response) =>
    //     'error' in response
    //       ? { ...store, error: { ...store.error, ...response } }
    //       : { ...store, success: { ...store.success, ...response } },
    //   {} as Api.ConnectorApiResponse
    // )
  }

  return { makeDualApiCalls }
}
