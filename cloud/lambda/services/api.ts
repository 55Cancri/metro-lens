import * as Api from '../types/api'
import { winston } from '../utils/unicorns'
import * as arrayUtils from '../utils/arrays'

const URLS = {
  connector: {
    stops: 'https://www.fairfaxcounty.gov/bustime/api/v3/getstops',
    routes: 'https://www.fairfaxcounty.gov/bustime/api/v3/getroutes',
    patterns: 'https://www.fairfaxcounty.gov/bustime/api/v3/getpatterns',
    predictions: 'https://www.fairfaxcounty.gov/bustime/api/v3/getpredictions',
    directions: 'https://www.fairfaxcounty.gov/bustime/api/v3/getdirections',
    vehicles: 'https://www.fairfaxcounty.gov/bustime/api/v3/getvehicles',
  },
  wmata: { Predictions: '' },
} as const

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
  /* get vehicles */
  const getVehicles = async (params: Api.HttpClientConnectorParams) =>
    httpClient
      .get(URLS.connector.vehicles, {
        headers: { 'Content-Type': 'application/json' },
        params,
      })
      .then(({ data }) => data['bustime-response'] as Api.ConnectorApiVehicle)
      .catch((error) => {
        winston.error(error)
        throw new Error('Vehicles Api Error')
      })

  /* get vehicle predictions */
  const getPredictions = async (params: Api.HttpClientConnectorParams) =>
    httpClient
      .get(URLS.connector.predictions, {
        headers: { 'Content-Type': 'application/json' },
        params,
      })
      .then(
        ({ data }) => data['bustime-response'] as Api.ConnectorApiPrediction
      )
      .catch((error) => {
        winston.error(error)
        throw new Error('Predictions Api Error')
      })

  /* get vehicle predictions */
  const getEveryRoute = async (params: Api.HttpClientConnectorParams) =>
    httpClient
      .get(URLS.connector.routes, {
        headers: { 'Content-Type': 'application/json' },
        params,
      })
      .then(({ data }) => ({
        data: data['bustime-response'] as Api.ConnectorApiRoute,
        routeApiCount: 1,
      }))
      .catch((error) => {
        winston.error(error)
        throw new Error('Routes Api Error')
      })

  /* get stop */
  const getStop = async ({
    rt_dir,
    ...params
  }: Api.HttpClientConnectorParams) =>
    httpClient
      .get(URLS.connector.stops, {
        headers: { 'Content-Type': 'application/json' },
        params,
      })
      .then(({ data }) => {
        const { stops } = data['bustime-response'] as Api.ConnectorApiStop
        const { rt } = params
        return stops.map(({ stpid, stpnm, lat, lon }) => ({
          routeId: rt_dir ? rt_dir : rt!,
          stopName: stpnm,
          stopId: stpid,
          lat,
          lon,
        }))
      })
      .catch((error) => {
        winston.error(error)
        throw new Error('Stop Api Error')
      })

  const getDirectionsForEveryRoute = async (
    params: Api.HttpClientConnectorParams,
    routes: Api.ConnectorRoute[]
  ) =>
    Promise.all(
      routes.map(({ rt }) =>
        httpClient
          .get(URLS.connector.directions, {
            headers: { 'Content-Type': 'application/json' },
            params: { ...params, rt },
          })
          .then(({ data }) => {
            type RouteDirection = {
              rt: string
              dir: string
              rt_dir: string | undefined
            }

            const { directions } = data[
              'bustime-response'
            ] as Api.ConnectorApiDirection

            return directions.reduce(
              (store, direction) => [
                ...store,
                {
                  rt,
                  dir: direction.name,
                  // TODO: save direction here somehow
                  rt_dir:
                    directions.length > 1
                      ? `${rt}_${direction.name}`
                      : undefined,
                },
              ],
              [] as RouteDirection[]
            )
          })
          .catch((error) => {
            winston.error(error)
            throw new Error('Directions Api Error')
          })
      )
    ).then((routeDirections) => ({
      directions: routeDirections.flat(),
      directionApiCount: routes.length,
    }))

  const getMapForEveryRoute = (
    params: Api.HttpClientConnectorParams,
    routes: Api.ConnectorRoute[]
  ) => {
    console.log('All routes:')
    const patternPromise = routes.map(async ({ rt }) => {
      type Pattern = {
        stopId?: string
        stopName?: string
        lat: number
        lon: number
        type: any
        sequence: number
        routeDirection: string
      }

      const { data } = await httpClient
        .get(URLS.connector.patterns, {
          headers: { 'Content-Type': 'application/json' },
          params: { ...params, rt },
        })
        .catch((error) => {
          winston.error(error)
          throw new Error('Patterns Api Error')
        })

      const { ptr } = data['bustime-response'] as Api.ConnectorApiPattern

      const mapList = ptr.reduce((store, { pt, rtdir }) => {
        const key = `map_${rt}_${rtdir}`

        const duplicateKey = store.some((item) => item.key === key)

        if (duplicateKey) {
          /* some route are backwards and forwards with same stops */
          return store
        }

        const routeMap = pt.map(({ typ, lat, lon, seq, stpid, stpnm }) => ({
          lat,
          lon,
          type: /s/i.test(typ) ? 'stop' : 'waypoint',
          sequence: seq,
          routeDirection: rtdir,
          ...(stpnm ? { stopName: stpnm } : {}),
          ...(stpid ? { stopId: stpid } : {}),
        }))

        const item = { key, map: routeMap }

        return [...store, item]
      }, [] as { key: string; map: Pattern[] }[])

      return mapList
    })

    return Promise.all(patternPromise).then((data) => ({
      patternApiCount: routes.length,
      patterns: data.flat(),
    }))
  }

  const getVehiclesForEveryRoute = async (
    params: Api.HttpClientConnectorParams
  ) => {
    /* get all routes */
    const { data, routeApiCount } = await getEveryRoute(params)

    /* extract routes from the response */
    const { routes } = data

    /* map over each route and get the associated vehicles */
    return Promise.all(
      routes.map(({ rt }) =>
        getVehicles({ ...params, rt }).then((vehicles) =>
          vehicles.vehicle ? vehicles.vehicle : []
        )
      )
    ).then((vehicles) => vehicles.flat())
  }

  const getEveryStop = async (params: Api.HttpClientConnectorParams) => {
    /* get all routes */
    const { data, routeApiCount } = await getEveryRoute(params)

    /* extract routes from the response */
    const { routes } = data

    /* get the directions for every route */
    const { directions, directionApiCount } = await getDirectionsForEveryRoute(
      params,
      routes
    )

    winston.info({
      routeNum: routeApiCount,
      dirNum: directionApiCount,
      stopNum: directions.length,
    })

    return Promise.all(
      directions.map(({ dir, rt, rt_dir }) =>
        getStop({ ...params, rt, dir, rt_dir })
      )
    ).then((stops) => ({
      stops: stops.flat(),
      stopApiCount: directions.length + directionApiCount + routeApiCount,
    }))
  }
  const getEveryMap = async (params: Api.HttpClientConnectorParams) => {
    /* get all routes */
    const { data, routeApiCount } = await getEveryRoute(params)

    /* extract routes from the response */
    const { routes } = data

    /* get the stops and waypoints for every route */
    const { patterns, patternApiCount } = await getMapForEveryRoute(
      params,
      routes
    )

    winston.info({
      routeNum: routeApiCount,
      patternNum: patternApiCount,
    })

    return { patterns, mapApiCount: routeApiCount + patternApiCount }
  }

  const getActiveVehicles = async (params: Api.HttpClientConnectorParams) => {
    const vehicles = await getVehiclesForEveryRoute(params)

    /* create a map of the active vehicles returned from the api call */
    const statusOfBuses = vehicles.reduce(
      (store, vehicle) => ({
        ...store,
        [vehicle.vid]: { isActive: true, wentOffline: null },
      }),
      {} as {
        [key: string]: { isActive: boolean; wentOffline: string | null }
      }
    )

    const initialRouteCall = 1

    const routeApiCount = vehicles.length + initialRouteCall

    return { statusOfBuses, routeApiCount }
  }

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

    const errors = [
      ...arrayUtils.defaultSpread(vehicles?.error),
      ...arrayUtils.defaultSpread(predictions?.error),
    ]

    const vehicleData = [
      ...arrayUtils.defaultSpread(vehicles.vehicle),
      ...arrayUtils.defaultSpread(predictions.prd),
    ]

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

  return {
    getStop,
    getVehicles,
    getPredictions,
    getEveryMap,
    getEveryStop,
    getEveryRoute,
    getVehiclesForEveryRoute,
    getActiveVehicles,
    makeDualApiCalls,
  }
}
