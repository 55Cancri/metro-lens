import * as Api from "../types/api"

const CONNECTOR_KEY = process.env.CONNECTOR_KEY || ""

/**
 * Create api params for each ten item chunk of vehicle items.
 * @param chunkedVehicleIds
 */
export const getApiParams = (
  chunkedVehicleIds: string[][]
): Api.HttpClientConnectorParams[] =>
  chunkedVehicleIds.map((listOfVehicleIds) => ({
    key: CONNECTOR_KEY,
    format: "json",
    vid: listOfVehicleIds.join(","),
  }))
