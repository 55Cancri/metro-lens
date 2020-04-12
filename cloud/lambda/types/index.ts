export type RequestOptions = {
  url: string
  headers?: {
    api_key?: string
  }
  params?: {
    key?: string
    format?: 'json'
    stpid?: string
    StopID?: string
  }
}
