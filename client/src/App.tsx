/** @jsx jsx */
import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { parse, formatDistanceToNow, addMinutes } from 'date-fns'
import { jsx } from '@emotion/core'
import './App.css'

const wmataPrimaryKey = 'cd6f240fe8e845b2b3cc4a3d824513b2'
// const wmataSecondaryKey = '0d73e33778874aa9a8c55c47c2f38c5f'
const connectorKey = 'knEZ3gqEcF3Y9vgpujB8eCixa'

type State = {
  wmata: WmataPredictions;
  connector: ConnectorPredictions;
}

const styles: Styles = {
  padding: '20px 50px'
}

const App = () => {
  const [services, setServices] = useState<State>({ wmata: {}, connector: {} })
  const [loading, setLoading] = useState(true)

  const makeCalls = async () => {
    const toDunnLoring2A = await axios.get(
      'https://api.wmata.com/NextBusService.svc/json/jPredictions',
      {
        headers: { api_key: wmataPrimaryKey },
        params: { StopID: '5001306' }
      }
    )

    const toDunnLoring1C = await axios.get(
      'https://api.wmata.com/NextBusService.svc/json/jPredictions',
      {
        headers: { api_key: wmataPrimaryKey },
        params: { StopID: '5003875' }
      }
    )

    const toLovingHut2A = await axios.get(
      'https://api.wmata.com/NextBusService.svc/json/jPredictions',
      {
        headers: { api_key: wmataPrimaryKey },
        params: { StopID: '5001305' }
      }
    )

    const fromDunnLoring2A = await axios.get(
      'https://api.wmata.com/NextBusService.svc/json/jPredictions',
      {
        headers: { api_key: wmataPrimaryKey },
        params: { StopID: '5004800' }
      }
    )

    const fromDunnLoring1B = await axios.get(
      'https://api.wmata.com/NextBusService.svc/json/jPredictions',
      {
        headers: { api_key: wmataPrimaryKey },
        params: { StopID: '5004802' }
      }
    )

    const fromLovingHut2A = await axios.get(
      'https://api.wmata.com/NextBusService.svc/json/jPredictions',
      {
        headers: { api_key: wmataPrimaryKey },
        params: { StopID: '5001330' }
      }
    )

    console.log(fromLovingHut2A.data.Predictions)

    const wmata = {
      'toDunnLoring-2a': toDunnLoring2A.data.Predictions,
      'toDunnLoring-1c': toDunnLoring1C.data.Predictions,
      'toLovingHut-2a': toLovingHut2A.data.Predictions,
      'fromDunnLoring-1b': fromDunnLoring1B.data.Predictions,
      'fromDunnLoring-2a': fromDunnLoring2A.data.Predictions,
      'fromLovingHut-2a': fromLovingHut2A.data.Predictions
    } as const

    console.log(wmata)

    /**
     * rt: "401", rtnm: "Backlick - Gallows Road Line", (dir=North)
     *  getstops = /getstops?rt=401&dir=North
     *    stpid: "2101", stpnm: "Gallows Rd and Lee Hwy", (+lat&lon)
     *    stpid: "6489", stpnm: "Tysons Corner Metro Bay F", (+lat&lon)
     *
     * rt: "402", rtnm: "Tysons-Gallows-Springfield Line", (dir=South)
     *  getstops = /getstops?rt=402&dir=South
     *    (north to dunn loring) stpid: "2101", stpnm: "Gallows Rd and Lee Hwy", (+lat&lon)
     *
     *    (south to springfield) stpid: "6489", stpnm: "Tysons Corner Metro Bay F", (+lat&lon)
     *    (south to springfield) stpid: "6345", stpnm: "Dunn Loring Metro", (+lat&lon)
     *    (south to springfield) stpid: "2100", stpnm: "Gallows Rd and Lee Hwy", (+lat&lon)
     *
     * rt: "505", rtnm: "Reston Town Center - Wiehle", (dir=East|West)
     *    (to metro) stpid: "4011", stpnm: "Reston Town Ctr Bay H"
     *    (to reston) stpid: "6486", stpnm: "Wiehle Metro Bay K"
     *
     * rt: "983", rtnm: "Wiehle - Dulles Airport", (dir=East|West)
     *    (to metro) stpid: "1383", stpnm: "Reston Town Ctr Bay K"
     *    (to reston) stpid: "6486", stpnm: "Wiehle Metro Bay K"
     *
     */
    const connector = await axios.get(
      'https://www.fairfaxcounty.gov/bustime/api/v3/getpredictions',
      {
        headers: { 'Content-Type': 'application/json' },
        params: {
          key: connectorKey,
          format: 'json',
          stpid: '2101,6489,6345,2100,6486,1383,4011'
        }
      }
    )

    return { wmata, connector }
  }

  const getSentenceDate = (date: Date) =>
    formatDistanceToNow(date, { includeSeconds: true })

  const formatConjunction = (items: Date[]) => {
    const [lastItem, ...remainingItems] = items.reverse()

    if (items.length === 0) {
      return undefined
    }

    if (items.length === 1) {
      return getSentenceDate(lastItem)
    }

    const sentence = remainingItems
      .reverse()
      .map((item) => getSentenceDate(item))
      .join(', ')

    const oxfordComma = items.length > 2 ? ',' : ''

    return `${sentence}${oxfordComma} and ${getSentenceDate(lastItem)}.`
  }

  useEffect(() => {
    makeCalls()
      .then((results) => {
        setServices(results)
        return setLoading(false)
      })
      .catch((error) => console.error(error))
  }, [])

  if (loading) {
    return <p>Loading...</p>
  }

  const extractMinutes = ({ Minutes }: WmataPrediction) => Minutes

  const wmataTimes = Object.entries(services.wmata).reduce(
    (store: WmataArrivalTimeHashSet, [key, wmataPredictions]) => ({
      ...store,
      [key]: (wmataPredictions as WmataPrediction[]).map((prediction) =>
        addMinutes(new Date(), extractMinutes(prediction))
      )
    }),
    {}
  )

  // parse the odd date string format of the predicted time (prdtm)
  const parseConnectorDate = (date: string) =>
    parse(date, 'yyyyLLdd kk:mm', new Date())

  const connectorTimes = services.connector.data[
    'bustime-response'
  ]?.prd.reduce(
    (store: ConnectorArrivalTimeHashSet, prediction: ConnectorPrediction) => {
      // extract data that may be relevant in the future
      const { prdtm, /* stpnm, */ stpid, rt, dly } = prediction

      // define the key
      const key = `${stpid}-${rt}`

      // convert data to a date object
      const arrivalTime = addMinutes(parseConnectorDate(prdtm), Number(dly))

      // if the stop + route (e.g. 402) combination has already been found,
      if (store[key]) {
        // simply append to it
        return { ...store, [key]: [...store[key], arrivalTime] }
      }

      // otherwise create a new key / value pair
      return { ...store, [key]: [arrivalTime] }
    },
    {}
  )

  const times = { ...connectorTimes, ...wmataTimes }

  console.log({ times })

  const getArrivalTimes = (key: string) => {
    const arrivals = times[key]
    return Array.isArray(arrivals) ? formatConjunction(arrivals) : ''
  }

  return (
    <div css={styles}>
      <header>
        <h1>Metro Lens</h1>
      </header>
      <main>
        <div>
          <h2>Home to Dunn-Loring</h2>
          <div>
            <p>
              401 is arriving in
              {' '}
              {getArrivalTimes('2101-401')}
            </p>
            <p>
              2A arriving in
              {' '}
              {getArrivalTimes('toDunnLoring-2a')}
            </p>
            <p>
              IC arriving in
              {' '}
              {getArrivalTimes('toDunnLoring-1c')}
            </p>
          </div>
        </div>
        <div>
          <h2>Dunn-Loring to Home</h2>
          <div>
            <p>
              402 arriving in
              {' '}
              {getArrivalTimes('6345-402')}
            </p>
            <p>
              2A arriving in
              {' '}
              {getArrivalTimes('fromDunnLoring-2a')}
            </p>
            <p>
              1B arriving in
              {' '}
              {getArrivalTimes('fromDunnLoring-1b')}
            </p>
          </div>
        </div>
        <div>
          <h2>Home to Tysons Corner</h2>
          <div>
            <p>
              401 arriving in
              {' '}
              {getArrivalTimes('2101-401')}
            </p>
          </div>
        </div>
        <div>
          <h2>Tysons Corner to Home</h2>
          <div>
            <p>
              402 arriving in
              {' '}
              {getArrivalTimes('6489-401')}
            </p>
          </div>
        </div>
        <div>
          <h2>Wiehle-Reston to Work</h2>
          <div>
            <p>
              505 arriving in
              {' '}
              {getArrivalTimes('6486-505')}
            </p>
            <p>
              983 arriving in
              {' '}
              {getArrivalTimes('6486-983')}
            </p>
          </div>
        </div>
        <div>
          <h2>Work to Wiehle-Reston</h2>
          <div>
            <p>
              505 arriving in
              {' '}
              {getArrivalTimes('4011-505')}
            </p>
            <p>
              983 arriving in
              {' '}
              {getArrivalTimes('1383-983')}
            </p>
          </div>
        </div>
        <div>
          <h2>Home to Loving Hut</h2>
          <div>
            <p>
              2A arriving in
              {' '}
              {getArrivalTimes('toLovingHut-2a')}
              {' '}
            </p>
          </div>
        </div>
        <div>
          <h2>Loving Hut to Home</h2>
          <div>
            <p>
              2A arriving in
              {' '}
              {getArrivalTimes('fromLovingHut-2a')}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
