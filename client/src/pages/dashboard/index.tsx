/** @jsx jsx */
import React from "react"
import { useHistory } from "react-router-dom"
import { motion } from "framer-motion"
import { jsx } from "@emotion/core"
import axios from "axios"
import * as L from "react-leaflet"

import * as urls from "../../constants/urls"
import * as variants from "../../constants/variants"
import { useDimensions } from "../../hooks/use-dimensions"
import * as apolloHooks from "../../types/apollo-hooks"
import * as sideEffects from "./methods/side-effects"
import { styles } from "./styles"
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

export type Point = Omit<UserPosition, "zoom">

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
      "2101": {
        "Gallows Rd": {
          lat: 2,
          lon: 4,
          type: "waypoint",
        },
        // ...
      },
      // ...
    },
  },
}

export const DashboardPage: React.FC = () => {
  const [loading, setLoading] = React.useState(true)
  const [userPosition, setUserPosition] = React.useState<Partial<UserPosition>>(
    {}
  )
  const [mapLink, setMapLink] = React.useState("")
  const vehicleSubscription = apolloHooks.useOnUpdateVehiclePositionsSubscription()
  const testSubscription = apolloHooks.useTestedMutationSubscription()
  // const [mapRef, mapDimensions] = useDimensions()

  console.log("VEHICLE SUBSCRIPTION: ")
  console.log({ vehicleSubscription })

  const history = useHistory()

  const handleLogout = () => {
    localStorage.removeItem("jwt")
    return history.push("/")
  }

  const setLocalState = ({ lat, lon }: Point) => {
    const zoom = 16
    setUserPosition({ lat, lon, zoom })
    setMapLink(`https://www.openstreetmap.org/#map=18/${lat}/${lon}`)
    return setLoading(false)
  }

  React.useEffect(() => {
    const id = sideEffects.trackUserPosition(setLocalState)
    // return stopTrackingUserPosition(id)
  }, [])

  if (loading) return <motion.p>Loading...</motion.p>

  // console.log({ mapDimensions })

  return (
    <motion.div
      css={styles.layout}
      variants={variants.page}
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
          <button onClick={handleLogout}>Logout</button>
        </nav>
        <input css={styles.input} />
      </header>
      <main>
        <div>
          <h2>Home to Dunn-Loring</h2>
          <a href={mapLink}>link</a>
        </div>

        <L.Map
          style={{ height: 500, width: "100%" }}
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
