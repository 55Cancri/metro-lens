/** @jsx jsx */
import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { jsx } from '@emotion/core'
import axios from 'axios'
import geo from 'latlon-geohash'
import * as L from 'react-leaflet'
import * as colors from '../constants/colors'
import * as urls from '../constants/urls'
import { useDimensions } from '../hooks/use-dimensions'
/**
 * Maps:
 * CartoDB.Voyager
 * CartoDB.Positron + (DarkMatter)
 *
 */

type UserPosition = {
  lat: number
  lon: number
  zoom: number
}

const styles: Styles = {
  layout: {
    padding: '20px 50px',
  },
  input: {
    display: 'grid',
    height: 25,
    width: '50%',
    marginTop: 25,
    padding: '4px 10px',
    border: 0,
    outline: 0,
    borderRadius: 4,
    backgroundColor: colors.grey15,
  },
}

const pageVariants = {
  initial: { scale: 0.9, opacity: 0 },
  enter: { scale: 1, opacity: 1 },
  exit: {
    scale: 0.5,
    opacity: 0,
    transition: { duration: 1.5 },
  },
}

const x = {
  // user location
  userPosition: {
    lat: 1,
    lon: 2,
  },
  transportPosition: {
    buses: {},
    metro: {},
  },
  geoPosition: {
    metroLines: {},
    routeStops: {
      '2101': {
        'Gallows Rd': {
          lat: 2,
          lon: 4,
          type: 'waypoint',
        },
        // ...
      },
      // ...
    },
  },
}

export const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [userPosition, setUserPosition] = useState<Partial<UserPosition>>({})
  const [mapLink, setMapLink] = useState('')
  // const [mapRef, mapDimensions] = useDimensions()

  const trackUserPosition = async () => {
    const onSuccess = (position: Position) => {
      const { latitude: lat } = position.coords
      const { longitude: lon } = position.coords

      const hash = geo.encode(lat, lon)

      const gallowsRd = geo.encode(38.873690918043, -77.226829000001)
      const tysonsCorner = geo.encode(38.919904915207, -77.222905999999)
      const restonTownCenter = geo.encode(38.957020912946, -77.359064)

      console.log({ position, hash, gallowsRd, tysonsCorner, restonTownCenter })

      setUserPosition({ lat, lon, zoom: 16 })
      setMapLink(`https://www.openstreetmap.org/#map=18/${lat}/${lon}`)
      setLoading(false)
    }

    const onError = (error: PositionError) => {
      console.log({ error })
      console.log('Unable to retrieve your location')
    }

    if (!navigator.geolocation) {
      console.log('Geolocation is not supported by your browser')
    } else {
      console.log('Locating…')
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        timeout: 30 * 1000,
        maximumAge: 0,
      })
    }
  }

  const stopTrackingUserPosition = (id: string) => {}

  useEffect(() => {
    const id = trackUserPosition()
    // return stopTrackingUserPosition(id)
  }, [])

  if (loading) return <motion.p>Loading...</motion.p>

  // console.log({ mapDimensions })

  return (
    <motion.div
      css={styles.layout}
      variants={pageVariants}
      initial="exit"
      animate="enter"
      exit="exit"
    >
      <header>
        <h1>Metro Lens</h1>
        <nav>
          <button>Map</button>
          <button>Favorites</button>
          <button>Search</button>
        </nav>
        <input css={styles.input} />
      </header>
      <main>
        <div>
          <h2>Home to Dunn-Loring</h2>
          <a href={mapLink}>link</a>
        </div>

        <L.Map
          style={{ height: 500, width: '100%' }}
          center={[userPosition.lat!, userPosition.lon!]}
          zoom={userPosition.zoom}
          ref={(node) =>
            console.log({ node: node?.container?.getBoundingClientRect() })
          }
        >
          <L.TileLayer url={urls.lightMap} />
          <L.Marker position={[userPosition.lat!, userPosition.lon!]}>
            <L.Popup>
              A pretty CSS3 popup. <br /> Easily customizable.
            </L.Popup>
          </L.Marker>
        </L.Map>
      </main>
    </motion.div>
  )
}
