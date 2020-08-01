/** @jsx jsx */
import React from "react"
import { useHistory } from "react-router-dom"
import { motion } from "framer-motion"
import { jsx } from "@emotion/core"
import * as L from "react-leaflet"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import axios from "axios"

import { Header } from "./components/header"
import { Refocus } from "./components/refocus"
// import { VehicleMarkers } from "./components/vehicle-markers"

import { useDimensions } from "../../hooks/use-dimensions"
import * as apolloHooks from "../../types/apollo-hooks"
import * as transformations from "./utils/transformations"
import * as sideEffects from "./utils/side-effects"
import * as variants from "../../constants/variants"
import * as colors from "../../constants/colors"
import * as urls from "../../constants/urls"
import * as styles from "./styles"

import { LatLngExpression, LeafletEvent } from "leaflet"

/**
 * Maps:
 * CartoDB.Voyager
 * CartoDB.Positron + (DarkMatter)
 *
 */

type ViewPosition = Record<"lat" | "lon" | "zoom", number>

export type Point = Omit<ViewPosition, "zoom">

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

const routeColors = new Map([
  ["101", "FireBrick"],
  ["109", "Salmon"],
  ["151", "Tomato"],
  ["152", "Orange"],
  ["159", "MediumOrchid"],
  ["161", "MediumPurple"],
  ["162", "RebeccaPurple"],
  ["171", "DarkMagenta"],
  ["231", "Indigo"],
  ["301", "SlateBlue"],
  ["305", "DarkSlateBlue"],
  ["306", "LimeGreen"],
  ["308", "LightGreen"],
  ["310", "MediumSpringGreen"],
  ["321", "SpringGreen"],
  ["322", "MediumSeaGreen"],
  ["334", "YellowGreen"],
  ["335", "MediumAquamarine"],
  ["340", "LightSeaGreen"],
  ["341", "Teal"],
  ["371", "MediumTurquoise"],
  ["372", "SteelBlue"],
  ["373", "CornflowerBlue"],
  ["393", "MediumSlateBlue"],
  ["394", "RoyalBlue"],
  ["395", "MidnightBlue"],
  ["396", "SandyBrown"],
  ["401", "Peru"],
  ["402", "LightSlateGray"],
  ["422", "LightSlateGray"],
  ["423", "Salmon"],
  ["424", "Crimson"],
  ["432", "PaleVioletRed"],
  ["461", "Orange"],
  ["462", "Thistle"],
  ["463", "Plum"],
  ["466", "Orchid"],
  ["467", "MediumOrchid"],
  ["480", "MediumPurple"],
  ["494", "DarkOrchid"],
  ["495", "DarkMagenta"],
  ["505", "Indigo"],
  ["507", "SlateBlue"],
  ["551", "DarkSlateBlue"],
  ["552", "MediumSlateBlue"],
  ["553", "PaleGreen"],
  ["554", "LightGreen"],
  ["556", "MediumSpringGreen"],
  ["557", "MediumSeaGreen"],
  ["558", "SeaGreen"],
  ["574", "OliveDrab"],
  ["585", "Olive"],
  ["599", "MediumAquamarine"],
  ["605", "DarkCyan"],
  ["621", "PaleTurquoise"],
  ["622", "MediumTurquoise"],
  ["623", "CadetBlue"],
  ["624", "SteelBlue"],
  ["631", "CornflowerBlue"],
])

export const DashboardPage: React.FC = () => {
  const [loadingLocation, setLoadingLocation] = React.useState(true)
  const [userPosition, setUserPosition] = React.useState<Partial<ViewPosition>>(
    {}
  )
  const [viewPosition, setViewPosition] = React.useState<Partial<ViewPosition>>(
    {}
  )
  const [vehicles, setVehicles] = React.useState(new Map())
  const [mapView, setMapView] = React.useState<any[]>([])
  const [mapLink, setMapLink] = React.useState("")

  const {
    loading: loadingInitialVehicles,
    data: initialVehicleData,
  } = apolloHooks.useGetVehiclePositionsQuery()
  const {
    loading: loadingUpdatedVehicles,
    data: updatedVehicleData,
  } = apolloHooks.useOnUpdateVehiclePositionsSubscription()

  const [
    runMapQuery,
    { loading: loadingMap, data: mapData },
  ] = apolloHooks.useGetMapLazyQuery()

  if (
    !loadingMap &&
    mapView.length === 0 &&
    mapData &&
    mapData.results?.length > 0
  ) {
    setMapView(mapData.results)
  }

  // console.log({ mapData })

  const history = useHistory()

  const { getVehiclePositions: initialVehicles } = initialVehicleData ?? {}
  const { onUpdateVehiclePositions: updatedVehicles } = updatedVehicleData ?? {}

  /**
   * Continuously track the user's geolocation.
   * @param {Point} point
   */
  const setInitialUserLocation = ({ lat, lon }: Point) => {
    const zoom = 16
    setViewPosition({ lat, lon, zoom })
    setUserPosition({ lat, lon, zoom })
    setMapLink(`https://www.openstreetmap.org/#map=18/${lat}/${lon}`)
    return setLoadingLocation(false)
  }

  const setUpdatedUserLocation = ({ lat, lon }: Point) => {
    setUserPosition({ ...userPosition, lat, lon })
    setMapLink(`https://www.openstreetmap.org/#map=18/${lat}/${lon}`)
  }

  const getDirection = (route: string, destination: string) => {
    const goingNorth =
      /(north|tysons corner)/i.test(destination) || route === "401"

    const goingSouth =
      /(south|dunn loring)/i.test(destination) || route === "402"

    if (goingNorth) return "North"

    if (goingSouth) return "South"

    if (/east/i.test(destination)) return "East"

    if (/west/i.test(destination)) return "West"

    if (/counter clockwise loop/i.test(destination))
      return "Counter clockwise loop"

    if (/clockwise loop/i.test(destination)) return "Clockwise loop"

    if (/unidirectional loop/i.test(destination)) return "Unidirectional loop"

    if (/inbound to franconia-springfield/i.test(destination))
      return "Inbound To Franconia-Springfield"

    if (/outbound to patriot ridge/i.test(destination))
      return "Outbound To Patriot Ridge"

    if (/outbound to saratoga p&r/i.test(destination))
      return "Outbound To Saratoga P&R"

    if (/outbound to saratoga p&r/i.test(destination))
      return "Outbound To Saratoga P&R"

    throw new Error(
      `Cannot determine direction from ${route} and ${destination}.`
    )
  }

  /**
   * Start tracking the user's position on load.
   */
  const onLoad = () => {
    sideEffects.setInitialUserLocation(setInitialUserLocation)
    const id = sideEffects.trackUserLocation(setUpdatedUserLocation)
    return () => sideEffects.stopTrackingUserLocation(id!)
  }

  const onInitialVehicles = () => {
    const vehicleUpdates = transformations.updateVehicleMap(
      initialVehicles,
      vehicles
    )
    return setVehicles(vehicleUpdates)
  }
  const onUpdatedVehicles = () => {
    const vehicleUpdates = transformations.updateVehicleMap(
      updatedVehicles,
      vehicles
    )
    return setVehicles(vehicleUpdates)
  }

  /* keep track of map center */
  const onMove = (e: LeafletEvent) => {
    const { lat, lng: lon } = e.target.getCenter()
    const zoom = e.target.getZoom()
    const updatedViewPosition = { lat, lon, zoom }
    console.log("Updating view position.")
    return setViewPosition(updatedViewPosition)
  }

  const onRefocus = () => setViewPosition({ ...userPosition, zoom: 16 })

  /**
   * Clear session tokens on logout.
   */
  const onLogout = () => {
    localStorage.removeItem("jwt")
    return history.push("/")
  }

  React.useEffect(onLoad, [])
  React.useEffect(onInitialVehicles, [initialVehicles])
  React.useEffect(onUpdatedVehicles, [updatedVehicles])

  /* loading */
  const isLoading = loadingLocation || loadingInitialVehicles
  if (isLoading) return <motion.p>Loading...</motion.p>

  const vehicle = "402_7708"

  // const target = vehicles.get("402_9700")
  // console.log({ lat: target?.lat, lon: target?.lon })
  console.log(new Date().toLocaleTimeString())
  const target = vehicles.get(vehicle)
  console.log(
    vehicle,
    "lat:",
    target?.currentLocation.lat,
    "lon:",
    target?.currentLocation.lon
  )
  // console.log({ vehicles })

  /* dark mode */
  const hour = new Date().getHours()
  const isNightTime = hour < 6 || hour > 20
  const mapTheme = isNightTime ? urls.darkMap : urls.lightMap

  /* map center and user marker */
  const mapCenter = [viewPosition.lat, viewPosition.lon] as LatLngExpression
  const userMarker = [userPosition.lat, userPosition.lon] as LatLngExpression
  return (
    <motion.div
      css={styles.layout}
      variants={variants.page}
      initial="exit"
      animate="enter"
      exit="exit"
    >
      {/* <header>
        <h1>Metro Lens</h1>
        <nav>
          <button>Map</button>
          <button>Favorites</button>
          <button>Search</button>
          <button onClick={onLogout}>Logout</button>
        </nav>
        <input css={styles.input} />
      </header> */}
      <main>
        <Header />
        <Refocus onClick={onRefocus} />
        <p
          css={{
            position: "absolute",
            zIndex: 100,
            bottom: 8,
            left: 35,
            color: isNightTime ? "darkgrey" : colors.grey95,
            fontSize: "1.4rem",
            fontWeight: 700,
          }}
        >
          {vehicles.size} active buses
        </p>
        <L.Map
          css={styles.map}
          center={mapCenter}
          onmoveend={onMove}
          zoom={viewPosition.zoom}
          zoomAnimation
          useFlyTo
          animate
          // ref={(node) =>
          //   console.log({ node: node?.container?.getBoundingClientRect() })
          // }
        >
          <L.TileLayer url={mapTheme} />
          <L.Marker
            css={{
              color: "red",
              backgroundColor: "red",
              filter: "grayscale(100%);",
            }}
            position={userMarker}
          >
            <L.Popup autoPan={false}>
              A pretty CSS3 popup. <br /> Easily customizable.
            </L.Popup>
            <L.Tooltip
              direction="right"
              offset={[-8, -2]}
              opacity={1}
              permanent
            >
              <span>You</span>
            </L.Tooltip>
          </L.Marker>
          <L.Polyline
            positions={mapView.map((point: any) => [point.lat, point.lon])}
            color={routeColors.get("401")}
          />
          {/* {mapView.map((point: any) => {
            const position = [[point.lat, point.lon]]
            console.log({ position })
            return <L.Polyline positions={position} color="blue" />
          })} */}
          {Array.from(vehicles.values()).map((vehicle) => {
            const {
              rt,
              vehicleId,
              mph,
              destination,
              sourceTimestamp,
              currentLocation,
            } = vehicle
            const key = `${rt}_${vehicleId}`
            const { lat, lon } = currentLocation
            const vehicleMarker = [Number(lat), Number(lon)] as LatLngExpression
            return (
              <L.Marker
                key={key}
                css={{
                  filter: "grayscale(50%);",
                }}
                onclick={(e) => {
                  const direction = getDirection(rt, destination)!
                  console.log("Sending: ", rt, direction)
                  runMapQuery({
                    variables: {
                      input: {
                        route: rt,
                        direction,
                      },
                    },
                  })
                }}
                position={vehicleMarker}
                title={vehicleId}
              >
                <L.Popup>
                  <p>{vehicleId}</p>
                  <h1>{rt}</h1>
                  A pretty CSS3 popup. <br /> Easily customizable.
                </L.Popup>
                <L.Tooltip
                  direction="right"
                  offset={[-8, -2]}
                  opacity={1}
                  permanent
                >
                  <div
                    css={{
                      display: "grid",
                      alignItems: "center",
                      gridTemplateColumns: "repeat(2, max-content)",
                      gridColumnGap: 3,
                      padding: "0 3px",
                    }}
                  >
                    <h1
                      css={{
                        fontSize: ".7rem",
                        margin: 0,
                        padding: 0,
                      }}
                    >
                      {rt}
                    </h1>
                    <p
                      css={{
                        fontSize: ".5rem",
                        margin: 0,
                        padding: 0,
                      }}
                    >
                      ({vehicleId})
                    </p>
                  </div>
                  <div>{destination}</div>
                </L.Tooltip>
              </L.Marker>
              // <L.Marker key={key} position={vehicleMarker} title={vehicleId}>
              //   <L.Popup>
              //     <p>{vehicleId}</p>
              //     <h1>{rt}</h1>
              //     A pretty CSS3 popup. <br /> Easily customizable.
              //   </L.Popup>
              // </L.Marker>
            )
          })}
          {/* <VehicleMarkers vehicles={vehicles!} /> */}
        </L.Map>
      </main>
    </motion.div>
  )
}
