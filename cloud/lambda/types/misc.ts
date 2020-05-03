export type GenericObject = Record<string, unknown>

export type AppsyncEvent<T> = {
  arguments: {
    input: T
  }
  identity: string | null
  source: string | null
  result: string | null
  request: {
    headers: {
      'x-forwarded-for': string
      'cloudfront-is-tablet-viewer': string
      'cloudfront-viewer-country': string
      via: string
      'cloudfront-forwarded-proto': string
      origin: string
      'content-length': string
      host: string
      'x-forwarded-proto': string
      'accept-language': string
      'user-agent': string
      'cloudfront-is-mobile-viewer': string
      accept: string
      'cloudfront-is-smarttv-viewer': string
      'accept-encoding': string
      referer: string
      'x-api-key': string
      'content-type': 'application/json'
      'sec-fetch-mode': 'cors'
      'x-amz-cf-id': string
      'x-amzn-trace-id': string
      'sec-fetch-dest': string
      'x-amz-user-agent': string
      'cloudfront-is-desktop-viewer': string
      'sec-fetch-site': string
      'x-forwarded-port': string
    }
  }
  info: {
    fieldName: string
    parentTypeName: 'Mutation' | 'Query'
    variables: {
      input: [any]
    }
  }
  error: any
  prev: any
  stash: {}
  outErrors: []
}
