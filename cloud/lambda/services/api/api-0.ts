import * as Api from "./types"
import { winston } from "../../utils/unicorns"
import * as Dynamo from "../dynamodb/types"

const URLS = {
  connector: {
    stops: "https://www.fairfaxcounty.gov/bustime/api/v3/getstops",
    routes: "https://www.fairfaxcounty.gov/bustime/api/v3/getroutes",
    patterns: "https://www.fairfaxcounty.gov/bustime/api/v3/getpatterns",
    predictions: "https://www.fairfaxcounty.gov/bustime/api/v3/getpredictions",
    directions: "https://www.fairfaxcounty.gov/bustime/api/v3/getdirections",
    vehicles: "https://www.fairfaxcounty.gov/bustime/api/v3/getvehicles",
  },
  wmata: { Predictions: "" },
} as const

export const apiServiceProvider = ({
  httpClient,
}: Api.ApiServiceProviderProps) => {
  /**
   * Make an api call to get the vehicle lat and lon.
   * @param params
   */
  const getVehicleLocations = async (params: Api.HttpClientConnectorParams) =>
    httpClient
      .get(URLS.connector.vehicles, {
        headers: { "Content-Type": "application/json" },
        params,
      })
      .then(({ data }) => data["bustime-response"] as Api.ConnectorApiVehicle)
      .catch((error) => {
        winston.error(error)
        throw new Error("Vehicles Api Error")
      })

  /**
   * Make an api call to get the vehicle predictions.
   * @param params
   */
  const getVehiclePredictions = async (params: Api.HttpClientConnectorParams) =>
    httpClient
      .get(URLS.connector.predictions, {
        headers: { "Content-Type": "application/json" },
        params,
      })
      .then(
        ({ data }) => data["bustime-response"] as Api.ConnectorApiPrediction
      )
      .catch((error) => {
        winston.error(error)
        throw new Error("Predictions Api Error")
      })

  /**
   * Perform a mutation for the prediction sets, one at a time.
   * @param params
   * @param predictionSet
   */
  const triggerVehicleMutation = (
    params: Record<"endpoint" | "apiKey", string>,
    predictionGroupId: number
  ) => {
    /* send a post request to appsync, which will then trigger the vehicle lambda */
    return httpClient.post(
      params.endpoint,
      {
        query: `mutation updateVehiclePositions($page: Int) {
          updateVehiclePositions(page: $page) {
              vehicleId
              rt
              lat
              lon
              lastUpdateTime
              predictions {
                  arrivalIn
                  arrivalTime
                  stopId
                  stopName
              }
          }
      }`,
        variables: { input: { predictionGroupId } },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": params.apiKey,
        },
      }
    )
  }

  /**
   * Perform a query for the `entity` and `id`.
   * @param endpoint
   */
  const testMutation = (endpoint: string) =>
    httpClient.post(
      endpoint,
      {
        query: `mutation testMutation {
          testMutation {
            entity
            id
          }
        }`,
      },
      { headers: { "Content-Type": "application/json" } }
    )

  /* get vehicle predictions */
  const getEveryVehicleRoute = async (params: Api.HttpClientConnectorParams) =>
    httpClient
      .get(URLS.connector.routes, {
        headers: { "Content-Type": "application/json" },
        params,
      })
      .then(({ data }) => ({
        data: data["bustime-response"] as Api.ConnectorApiRoute,
        routeApiCount: 1, // replaced by the `initialRouteCall` in getActiveVehicles
      }))
      .catch((error) => {
        winston.error(error)
        throw new Error("Routes Api Error")
      })

  /**
   * Get the vehicles.for a specific route using the `rt` parameter.
   * @param params
   */
  const getVehicles = async (params: Api.HttpClientConnectorParams) =>
    httpClient
      .get(URLS.connector.vehicles, {
        headers: { "Content-Type": "application/json" },
        params,
      })
      .then(({ data }) => data["bustime-response"] as Api.ConnectorApiVehicle)
      .catch((error) => {
        winston.error(error)
        throw new Error("Vehicles Api Error")
      })

  const getVehiclesForEveryRoute = async (
    params: Api.HttpClientConnectorParams
  ) => {
    /* get all routes */
    const { data, routeApiCount } = await getEveryVehicleRoute(params)
    const { routes } = data

    /* ignore the errors and just get the vehicles */
    const mapToVehicle = (vehicles: { vehicle?: Api.ConnectorVehicle[] }) =>
      vehicles.vehicle ? vehicles.vehicle : []

    const promises = routes.map(({ rt }) =>
      getVehicles({ ...params, rt }).then(mapToVehicle)
    )

    /* map over each route and get the associated vehicles */
    const vehicles = await Promise.all(promises)
    return vehicles.flat()
  }

  /**
   * Determine all the active vehicles purely from making api calls, starting
   * with the routes, then vehicles for each route, and then finally, parsing
   * out the vehicles that actually returned something. This is where the most
   * api calls occur.
   * @param params
   */
  const getActiveVehicles = async (params: Api.HttpClientConnectorParams) => {
    /* make api call to get the vehicles for every route */
    const vehicles = await getVehiclesForEveryRoute(params)

    /* create a map of the active vehicles returned from the api call */
    const activeVehicles = vehicles.reduce(
      (store, vehicle) => ({
        ...store,
        [vehicle.vid]: { isActive: true, wentOffline: null },
      }),
      {}
    )
    const statusOfVehicles = {
      active: activeVehicles,
      dormant: {},
    } as Dynamo.VehicleStatusItem
    const initialRouteCall = 1
    const routeApiCount = initialRouteCall + vehicles.length
    return { statusOfVehicles, routeApiCount }
  }

  const getDirectionsForEveryRoute = async (
    parameters: Api.HttpClientConnectorParams,
    routes: Api.ConnectorRoute[]
  ) => {
    const { rt_dir, ...params } = parameters

    /* make the api call */
    const getRoute = ({ rt }: Api.ConnectorRoute) =>
      httpClient
        .get<Api.BaseConnectorApiDirection>(URLS.connector.directions, {
          headers: { "Content-Type": "application/json" },
          params: { ...params, rt },
        })
        .then(({ data }) => ({ rt, data: data["bustime-response"] }))

    const handleError = (error: Error) => {
      winston.error(error)
      throw new Error(
        "Error getting directions from the fairfax connector api."
      )
    }
    /* make api calls to get every route */
    const allRoutesP = routes.map(getRoute)
    const allRoutes = await Promise.all(allRoutesP).catch(handleError)

    const allDirections = allRoutes.map(({ rt, data: { directions } }) => {
      /**
       * ! No clue what this code does!
       */
      const direction = directions.reduce((store, direction) => {
        // TODO: save direction here somehow
        const rt_dir =
          directions.length > 1 ? `${rt}_${direction.name}` : undefined
        const dir = direction.name
        const newRoute = { rt, dir, rt_dir }
        return [...store, newRoute]
      }, [] as Api.RouteDirection[])

      return direction
    })

    return {
      directions: allDirections.flat(),
      directionApiCount: routes.length,
    }
  }

  /**
   * Get the vehicle stop for a specific route and direction.
   * @param param0
   */
  const getVehicleStop = async ({
    rt_dir,
    ...params
  }: Api.HttpClientConnectorParams) =>
    httpClient
      .get(URLS.connector.stops, {
        headers: { "Content-Type": "application/json" },
        params,
      })
      .then(({ data }) => {
        const { stops } = data["bustime-response"] as Api.ConnectorApiStop
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
        throw new Error("Stop Api Error")
      })

  /**
   * Get every vehicle stop for every route.
   * @param params
   */
  const getEveryVehicleStop = async (args: Api.HttpClientConnectorParams) => {
    const { rt_dir, ...params } = args
    /* get all routes */
    const { data, routeApiCount } = await getEveryVehicleRoute(args)
    const { routes } = data
    const { directions, directionApiCount } = await getDirectionsForEveryRoute(
      params,
      routes
    )
    const makeApiCall = ({ dir, rt }: Api.RouteDirection) =>
      getVehicleStop({ ...params, rt, dir, rt_dir })
    const vehicleStopResponses = directions.map(makeApiCall)
    // const vehicleStops = directions.map(({ dir, rt, rt_dir }) =>
    //   getVehicleStop({ ...params, rt, dir, rt_dir })
    // )
    const vehicleStopList = await Promise.all(vehicleStopResponses)
    const vehicleStops = vehicleStopList.flat()
    const stopApiCount = directions.length + directionApiCount + routeApiCount
    return { vehicleStops, stopApiCount }

    // winston.info({
    //   routeNum: routeApiCount,
    //   dirNum: directionApiCount,
    //   stopNum: directions.length,
    // })

    // return Promise.all().then((stops) => ({
    //   stops: stops.flat(),
    //   stopApiCount: directions.length + directionApiCount + routeApiCount,
    // }))
  }

  /**
   * Make an api call to get the patterns for every route.
   * @param params
   * @param routes
   */
  const getMapForEveryRoute = async (
    params: Api.HttpClientConnectorParams,
    routes: Api.ConnectorRoute[]
  ) => {
    const getPatterns = async ({ rt }: Api.ConnectorRoute) =>
      httpClient
        .get<Api.BaseConnectorApiPattern>(URLS.connector.patterns, {
          headers: { "Content-Type": "application/json" },
          params: { ...params, rt },
        })
        .then(({ data }) => ({ data, rt }))
        .catch((error) => {
          winston.error(error)
          throw new Error("Patterns Api Error")
        })
    const promises = routes.map(getPatterns)
    const patternResults = await Promise.all(promises)

    type Args = { rt: string; data: Api.BaseConnectorApiPattern }
    const transformer = ({ rt, data }: Args) => {
      const { ptr } = data["bustime-response"]

      /* reduce the pattern responses to a list of map marker items */
      return ptr.reduce((store, { pt, rtdir }) => {
        const key = `map_${rt}_${rtdir}`
        const duplicateKey = store.some((item) => item.key === key)

        /* some route are backwards and forwards with identical stops */
        if (duplicateKey) {
          return store
        }
        const routeMap = pt.map(({ typ, lat, lon, seq, stpid, stpnm }) => {
          const stopName = stpnm ? { stopName: stpnm } : {}
          const stopId = stpid ? { stopId: stpid } : {}
          const type = /s/i.test(typ) ? "stop" : "waypoint"
          const sequence = seq
          const routeDirection = rtdir
          return {
            lat,
            lon,
            type,
            sequence,
            routeDirection,
            ...stopName,
            ...stopId,
          }
        })
        const item = { key, map: routeMap }
        return [...store, item]
      }, [] as Api.MarkerItem[])
    }
    const patternList = patternResults.map(transformer)
    const patternApiCount = routes.length
    const patterns = patternList.flat()
    return { patternApiCount, patterns }
  }

  const getEveryMapMarker = async (params: Api.HttpClientConnectorParams) => {
    /* get all routes */
    const { data, routeApiCount } = await getEveryVehicleRoute(params)
    const { routes } = data

    /* get the stops and waypoints for every route */
    const { patterns, patternApiCount } = await getMapForEveryRoute(
      params,
      routes
    )
    // winston.info({ routeNum: routeApiCount, patternNum: patternApiCount })
    return {
      mapMarkers: patterns,
      mapApiCount: routeApiCount + patternApiCount,
    }
  }

  return {
    getVehicles,
    getActiveVehicles,
    getVehicleLocations,
    getVehiclePredictions,
    getEveryVehicleStop,
    getEveryMapMarker,
    triggerVehicleMutation,
    testMutation,
  }
}
