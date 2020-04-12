export type ConnectorApiSuccess = {
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
  dly: true
  dyn: number
  prdctdn: string
  zone: string
  nbus: string
}

export type ConnectorApiFailure = {
  vid: string
  msg: string
}

export type ConnectorResponse = ConnectorApiSuccess | ConnectorApiFailure

export type ConnectorApiBase = {
  data: {
    'bustime-response': {
      prd?: ConnectorApiSuccess[]
      error?: ConnectorApiFailure[]
    }
  }
}
