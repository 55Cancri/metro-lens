import * as df from 'date-fns'

export const dateServiceProvider = () => {
  /**
   * Get the current time in ISO format.
   */
  const getNowInISO = ({ date = new Date() } = {}) => date.toISOString()

  const getNowInMs = ({ date = new Date() } = {}) => date.getTime()

  /**
   * Epoch must be specified in seconds if using as TTL attribute
   * @param date
   */
  const getEpochTime = ({ date = new Date() } = {}) =>
    Math.round(date.getTime() / 1000)

  /**
   * Epoch must be specified in seconds if using as TTL attribute
   * @param date
   */
  const getEpochTimeIn5Minutes = ({ date = new Date() } = {}) =>
    Math.round(df.addMinutes(date, 5).getTime() / 1000)

  const getDifferenceInHours = (date1: Date, date2: Date) =>
    df.differenceInHours(date1, date2)

  const getStartOfDay = ({ date = new Date(), asString = true } = {}) => {
    const time = df.startOfDay(date)
    return asString ? time.toISOString : time
  }

  const getEndOfDay = ({ date = new Date(), asString = true } = {}) => {
    const time = df.endOfDay(date)
    return asString ? time.toISOString : time
  }

  return {
    getNowInISO,
    getNowInMs,
    getEpochTime,
    getEpochTimeIn5Minutes,
    getDifferenceInHours,
    getStartOfDay,
    getEndOfDay,
  }
}
