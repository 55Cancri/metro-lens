// The primary source of dynamodb types

import aws from "aws-sdk"
import { dateServiceProvider } from "../../services/date"

type PrimaryKey = {
  entity: string
  id: string
}

export type CreateItemParams = {
  pk: string
  sk: string | number
}

export type Item = Record<string, unknown>

export type VehicleStatus = {
  isActive: boolean
  wentOffline: string | null
  predictionGroupId?: string
  statusGroupName?: string
}

export type PredictionStatus = {
  [vehicleId: string]: VehicleStatus
}

export type MetadataPredictionStatus = {
  [vehicleId: string]: Required<VehicleStatus>
}

export type PredictionEntry = [string, PredictionStatus]

export type Status = {
  [predictionId: string]: PredictionStatus
}

// TODO: remove allVehicleIds as they don't exist on the pk=vehicle,sk=status item
export type VehicleStatusItem = {
  active: Status
  dormant: Status
  // active: Status & { allVehicleIds: string[] }
  // dormant: Status & { allVehicleIds: string[] }
}

export type Prediction = {
  arrivalIn: string
  arrivalTime: string
  stopId: string
  stopName: string
}

export type PredictionWithDirection = {
  arrivalIn: string
  arrivalTime: string
  stopId: string
  stopName: string
  routeDirection: string
}

export type Coordinate = Record<"lat" | "lon", string>

export type Vehicle = {
  rt: string
  vehicleId: string
  destination: string
  routeDirection: string
  mph: string
  lastLocation: Partial<Coordinate>
  currentLocation: Coordinate
  predictions?: Prediction[]
  sourceTimestamp: string
  lastUpdateTime: string
}
// export type Vehicle = {
//   lastUpdateTime: string
//   lat: string
//   lon: string
//   rt: string
//   vehicleId: string
//   predictions?: Prediction[]
// }

export type Routes = { [routeIdVehicleId: string]: Vehicle }

export type VehiclePredictionItem = {
  /** The number of vehicles in each route id vehicle id is predetermined */
  routes: Routes
  allVehicles: string[]
}

export type PredictionItem = PrimaryKey & VehiclePredictionItem

// export type StatusItem = PrimaryKey & { status: VehicleStatusItem }

export type VehicleStop = {
  routeId: string
  stopName: string
  stopId: string
  lat: number
  lon: number
}

export type VehicleStopGroup = {
  [routeId: string]: {
    [stopId: string]: VehicleStop
  }
}

export type MapItem = PrimaryKey & {
  dateCreated: string
  map: {
    [key: string]: {
      stopId?: string
      stopName?: string
      sequence: number
      type: "stop" | "waypoint"
      routeDirection: string
      lat: string
      lon: string
    }
  }[]
}

// === evaluate the below ===

export type User = PrimaryKey & {
  uuid: string
  email: string
  password: string
  username: string
  dateCreated: string
  lastSignOn: string
  favoriteStops: {
    stopId: string
    stopName: string
    userLabel: string
  }[]
  locations: {
    lat: number
    lon: number
  }[]
}

export type BusStatusItem = PrimaryKey & {
  active: boolean
  vehicleId: number
  lastChecked: string
  dateCreated: string
  routes: string[]
}

export type BusVehicleItem = PrimaryKey & {
  curVer: number
  dateCreated: string
  lat: number
  lon: number
  mph: number
  stopId: string
  vehicleId: string
  stopName: string
  arriveIn: number
  arriveTime: string
  TTL: number
}

export type BusesByRouteId = PrimaryKey & {
  totalPredictionSets?: number
  routes: {
    [key: string]: {
      lat: string
      lon: string
      vehicleId: string
      lastUpdateTime: string
      predictions: Prediction[]
    }
  }
}

export type VehicleStopItem = PrimaryKey & {
  stops: {
    [key: string]: {
      lat: string
      lon: string
      routeId: string
      stopId: string
      stopName: string
    }
  }[]
}

export type ApiCountTodayItem = PrimaryKey & { apiCount: number }

export type ApiCountTotalItem = PrimaryKey & { apiCountTotal: number }

export type PutItemInput = aws.DynamoDB.PutItemInput

export type PutRequest = { PutRequest: { Item: BusStatusItem } }

// === below is good ===

export type WriteRequest = aws.DynamoDB.DocumentClient.WriteRequest

export type BatchWriteOutput = aws.DynamoDB.DocumentClient.BatchWriteItemOutput

export type QueryParams = aws.DynamoDB.DocumentClient.QueryInput

export type DynamoDB = aws.DynamoDB.DocumentClient
export type Date = ReturnType<typeof dateServiceProvider>

export type DynamoServiceProviderProps = {
  dynamodb: DynamoDB
  date: Date
}
