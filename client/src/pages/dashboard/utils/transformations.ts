/**
 * Update the local state map of vehicles.
 * @param vehiclesUpdates
 * @param initialState
 */
export const updateVehicleMap = (
  vehiclesUpdates: any[] = [],
  initialState: Map<any, any>
) =>
  vehiclesUpdates.reduce((store, vehicle) => {
    const key = `${vehicle.rt}_${vehicle.vehicleId}`
    return store.set(key, vehicle)
  }, initialState)
