/** @jsx jsx */
import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { jsx } from '@emotion/core'
import axios from 'axios'
import * as L from 'react-leaflet'
// const { Map: LeafletMap, TileLayer, Marker, Popup } = ReactLeaflet
import * as colors from '../constants/colors'
// import 'leaflet/dist/leaflet.css'

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
  type UserPosition = {
    lat: number
    lon: number
    zoom: number
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

  const [loading, setLoading] = useState(true)
  const [userPosition, setUserPosition] = useState<Partial<UserPosition>>({})
  const [mapLink, setMapLink] = useState('')

  const trackUserPosition = async () => {
    const onSuccess = (position: Position) => {
      const { latitude: lat } = position.coords
      const { longitude: lon } = position.coords

      console.log({ position })

      setUserPosition({ lat, lon, zoom: 13 })
      setMapLink(`https://www.openstreetmap.org/#map=18/${lat}/${lon}`)
      setLoading(false)
    }

    const onError = () => {
      console.log('Unable to retrieve your location')
    }

    if (!navigator.geolocation) {
      console.log('Geolocation is not supported by your browser')
    } else {
      console.log('Locating…')
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        timeout: 5 * 1000,
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
          style={{ height: 500, width: 500 }}
          center={[userPosition.lat!, userPosition.lon!]}
          zoom={userPosition.zoom}
        >
          <L.TileLayer
            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.osm.org/{z}/{x}/{y}.png"
          />
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
