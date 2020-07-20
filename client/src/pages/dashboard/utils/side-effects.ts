// import geo from "latlon-geohash"
import { Point } from "../index"

type UpdateState = (point: Point) => void

/**
 * Store the user's geolocation in local state.
 * @param updateState
 */
const setSuccess = (updateState: UpdateState) => (position: Position) => {
  /* get users geolocation */
  const { latitude: lat } = position.coords
  const { longitude: lon } = position.coords

  /* encode known locations using geohashing */
  // const hash = geo.encode(lat, lon)
  // const gallowsRd = geo.encode(38.873690918043, -77.226829000001)
  // const tysonsCorner = geo.encode(38.919904915207, -77.222905999999)
  // const restonTownCenter = geo.encode(38.957020912946, -77.359064)
  // console.log({ position, hash, gallowsRd, tysonsCorner, restonTownCenter })

  return updateState({ lat, lon })
}

/**
 * Report error if unable to find user's geolocation.
 * @param error
 */
const onError = (error: PositionError) => {
  console.error({ error })
  const message = "Geolocation Error: Unable to retrieve your location."
  console.error(message)
}

/**
 * Get navigator options.
 */
const getOptions = () => {
  const maximumAge = 0
  const timeout = 15 * 1000
  const enableHighAccuracy = true
  return { enableHighAccuracy, timeout, maximumAge }
}

/**
 * Determine the user's geolocation.
 * @param setLocalState
 */
export const setInitialUserLocation = (setInitialState: UpdateState) => {
  if (!navigator.geolocation) {
    const message =
      "Geolocation Error: Geolocation is not supported by your browser."
    console.warn(message)
  } else {
    console.log("Locating...")
    const options = getOptions()
    const onSuccess = setSuccess(setInitialState)
    return navigator.geolocation.getCurrentPosition(onSuccess, onError, options)
  }
}

/**
 * Determine the user's geolocation.
 * @param updateState
 */
export const trackUserLocation = (updateState: UpdateState) => {
  if (!navigator.geolocation) {
    const message =
      "Geolocation Error: Geolocation is not supported by your browser."
    console.warn(message)
  } else {
    console.log("Locating...")
    const options = getOptions()
    const onSuccess = setSuccess(updateState)
    return navigator.geolocation.watchPosition(onSuccess, onError, options)
  }
}

/**
 * Stop tracking the user's geolocation.
 * @param id
 */
export const stopTrackingUserLocation = (id: number) =>
  navigator.geolocation.clearWatch(id)
