import aws from 'aws-sdk'
import { dateServiceProvider } from '../services/date'

type PrimaryKey = {
  entity: string
  id: string
}

// BusStatusItem === Vehicle
export type BusStatusItem = PrimaryKey & {
  active: boolean
  vehicleId: number
  lastChecked: string
  dateCreated: string
  routes: string[]
}
// export type BusStatusItem = PrimaryKey & {
//   rt: string
//   vid: number
//   active: boolean
//   lastChecked: string
//   dateCreated: string
//   routes: string[]
// }

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

export type ApiCountTodayItem = PrimaryKey & { apiCount: number }

export type ApiCountTotalItem = PrimaryKey & { apiCountTotal: number }

export type PutRequest = { PutRequest: { Item: BusStatusItem } }

export type WriteRequest = aws.DynamoDB.DocumentClient.WriteRequest

export type QueryParams = aws.DynamoDB.DocumentClient.QueryInput

export type DynamoServiceProviderProps = {
  dynamodb: aws.DynamoDB.DocumentClient
  dateService: ReturnType<typeof dateServiceProvider>
}
