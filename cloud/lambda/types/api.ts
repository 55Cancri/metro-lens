import axios from 'axios'

export type HttpClientConnectorParams = {
  key?: string
  format?: 'json'
  stpid?: string
  StopID?: string
}

export type HttpClientOptions = {
  url: string
  headers?: {
    api_key?: string
  }
  params?: HttpClientConnectorParams
}

export type ApiServiceProviderProps = {
  httpClient: typeof axios
}

export type ConnectorPrediction = {
  tmstmp: string
  typ: string
  stpnm: string
  stpid: string
  vid: string
  dstp: number
  rt: string
  rtdd: string
  rtdir: string
  des: string
  prdtm: string
  tablockid: string
  tatripid: string
  dly: boolean
  dyn: number
  prdctdn: string
  zone: string
  nbus: string
}

export type ConnectorVehicle = {
  rt: string
  vid: string
  tmstmp: string
  lat: string
  lon: string
  hdg: string
  des: string
  pid: number
  spd: number
  pdist: number
  psgld: string
  prdtm: string
  tatripid: string
  tablockid: string
  zone: string
  mode: number
  dly: boolean
}

export type ConnectorError = {
  vid: string
  msg: string
}

export type ConnectorJoin = ConnectorPrediction & ConnectorVehicle

export type ConnectorApiResponse =
  | { success: ConnectorJoin }
  | { error: ConnectorError }
// export type ConnectorApiResponse =
//   | ConnectorPrediction
//   | ConnectorVehicle
//   | ConnectorApiFailure
// export type ConnectorResponse = ConnectorApiJoin | ConnectorApiFailure
// export type ConnectorResponse = ConnectorPrediction | ConnectorApiFailure

export type ConnectorApiPrediction = {
  prd: ConnectorPrediction[]
  error: ConnectorError[]
}

export type ConnectorApiVehicle = {
  vehicle: ConnectorVehicle[]
  error: ConnectorError[]
}

export type ConnectorApiBase<T> = {
  data: {
    'bustime-response': T & { error?: ConnectorError[] }
  }
}

export type ConnectorMerged = {
  data: ConnectorJoin[]
  errors: ConnectorError[]
}
