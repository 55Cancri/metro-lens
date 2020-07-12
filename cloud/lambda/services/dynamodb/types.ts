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
  predictionItemId?: string
}

export type PredictionStatus = {
  [vehicleId: string]: VehicleStatus
}

export type PredictionIdStatus = {
  [vehicleId: string]: VehicleStatus & { predictionItemId: number }
}

export type Status = { [predictionId: string]: PredictionStatus }

export type VehicleStatusItem = {
  active: Status
  dormant: Status
}

export type Prediction = {
  arrivalIn: string
  arrivalTime: string
  stopId: string
  stopName: string
}

export type Vehicle = {
  lastUpdateTime: string
  lat: string
  lon: string
  rt: string
  vehicleId: string
  predictions?: Prediction[]
}

export type VehiclePredictionItem = {
  routes: { [routeIdVehicleId: string]: Vehicle }
  allVehicles: string[]
}

export type PredictionItem = PrimaryKey & VehiclePredictionItem

export type StatusItem = PrimaryKey & { status: VehicleStatusItem }

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

export type MapItem = PrimaryKey & {
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
