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

  const getEpochDate = (date = new Date()) => new Date(date.getTime())

  /**
   * Epoch must be specified in seconds if using as TTL attribute
   * @param date
   */
  const getEpochTimeIn5Minutes = ({ date = new Date() } = {}) =>
    Math.round(df.addMinutes(date, 5).getTime() / 1000)

  /**
   * Epoch must be specified in seconds if using as TTL attribute
   * @param date
   */

  type TTLOptions = {
    seconds?: number
    minutes?: number
    hours?: number
    days?: number
    years?: number
  }

  const setTTLExpirationIn = (
    { seconds, minutes, hours, days, years }: TTLOptions,
    date = new Date()
  ) => {
    const withSeconds = seconds
      ? getEpochDate(df.addSeconds(date, seconds))
      : date

    const withMinutes = minutes
      ? getEpochDate(df.addMinutes(withSeconds, minutes))
      : withSeconds

    const withHours = hours
      ? getEpochDate(df.addHours(withMinutes, hours))
      : withMinutes

    const withDays = days
      ? getEpochDate(df.addDays(withHours, days))
      : withHours

    return years
      ? getEpochTime({ date: df.addYears(withDays, years) })
      : getEpochTime({ date: withDays })
  }

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

  const parsePredictedTime = (predictedTime: string) =>
    df.parse(predictedTime, 'yyyyMMdd HH:mm', new Date()).toISOString()

  const greaterThanMinsAgo = (offlineDateInISO: string | null, mins = 45) =>
    typeof offlineDateInISO === 'string' &&
    df.differenceInMinutes(new Date(), new Date(offlineDateInISO)) > mins

  return {
    getNowInISO,
    getNowInMs,
    getEpochTime,
    greaterThanMinsAgo,
    getEpochTimeIn5Minutes,
    getDifferenceInHours,
    setTTLExpirationIn,
    getStartOfDay,
    getEndOfDay,
    parsePredictedTime,
  }
}
