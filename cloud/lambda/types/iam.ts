import * as jwt from 'jsonwebtoken'

export type ClientRegister = {
  username: string
  email: string
  password: string
}

export type ClientLogin = {
  username: string
  password: string
}

export type PartialUser = {
  uuid: string
  email: string
  username: string
  password: string
  dateCreated: string
  lastSignOn: string
}

export type FullUser = {
  id: string
  email: string
  username: string
  password: string
  dateCreated: string
  lastSignOn: string
  favoriteStops: { stopId: string; stopName: string; userLabel: string }[]
  locations: { lat: number; lon: number }[]
}

export type IamServiceProviderProps = {
  iam: typeof jwt
}
