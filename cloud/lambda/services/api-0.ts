import * as Api from "../types/api"
import { winston } from "../utils/unicorns"
import { VehicleStatusItem } from "../services/dynamodb-0"

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
   * Perform a mutation for the prediction sets, one at a time.
   * @param params
   * @param predictionSet
   */
  const triggerVehicleMutation = (
    params: Record<"endpoint" | "apiKey", string>,
    predictionSet: number
  ) => {
    /* send a post request to appsync, which will then trigger the vehicle lambda */
    return httpClient.post(
      params.endpoint,
      {
        query: `mutation updateBusPositions($page: Int) {
          updateBusPositions(page: $page) {
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
        variables: { input: { predictionSet } },
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
  const getEveryRoute = async (params: Api.HttpClientConnectorParams) =>
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
    const { data } = await getEveryRoute(params)
    const { routes } = data

    /* ignore the errors and just get the vehicles */
    const mapToVehicle = (vehicles: { vehicle?: Api.ConnectorVehicle[] }) =>
      vehicles.vehicle ? vehicles.vehicle : []

    /* map over each route and get the associated vehicles */
    const vehicles = await Promise.all(
      routes.map(({ rt }) => getVehicles({ ...params, rt }).then(mapToVehicle))
    )
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
    } as VehicleStatusItem
    const initialRouteCall = 1
    const routeApiCount = initialRouteCall + vehicles.length
    return { statusOfVehicles, routeApiCount }
  }

  return { getVehicleLocations, getActiveVehicles, triggerVehicleMutation }
}
