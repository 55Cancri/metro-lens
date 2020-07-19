// import geo from "latlon-geohash"
import { Point } from "../index"

type SetLocalState = (point: Point) => void

/**
 * Store the user's geolocation in local state.
 * @param setLocalState
 */
const setSuccess = (setLocalState: SetLocalState) => (position: Position) => {
  /* get users geolocation */
  const { latitude: lat } = position.coords
  const { longitude: lon } = position.coords

  /* encode known locations using geohashing */
  // const hash = geo.encode(lat, lon)
  // const gallowsRd = geo.encode(38.873690918043, -77.226829000001)
  // const tysonsCorner = geo.encode(38.919904915207, -77.222905999999)
  // const restonTownCenter = geo.encode(38.957020912946, -77.359064)
  // console.log({ position, hash, gallowsRd, tysonsCorner, restonTownCenter })

  return setLocalState({ lat, lon })
}

/**
 * Report error if unable to find user's geolocation.
 * @param error
 */
const onError = (error: PositionError) => {
  console.error({ error })
  console.error("Unable to retrieve your location.")
}

/**
 * Determine the user's geolocation.
 * @param setLocalState
 */
export const trackUserPosition = (setLocalState: SetLocalState) => {
  if (!navigator.geolocation) {
    console.log("Geolocation is not supported by your browser.")
  } else {
    console.log("Locating...")
    const maximumAge = 0
    const timeout = 10 * 1000
    const enableHighAccuracy = true
    const options = { enableHighAccuracy, timeout, maximumAge }
    const onSuccess = setSuccess(setLocalState)
    return navigator.geolocation.getCurrentPosition(onSuccess, onError, options)
  }
}

/**
 * Stop tracking the user's geolocation.
 * @param id
 */
export const stopTrackingUserPosition = (id: string) => {}
