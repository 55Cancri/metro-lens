import * as df from 'date-fns'
import * as dfz from 'date-fns-timezone'
import { listTimeZones } from 'timezone-support'

const greaterThanMinsAgo = (offlineDateInISO: string | null, mins = 45) =>
  typeof offlineDateInISO === 'string' &&
  df.differenceInMinutes(new Date(offlineDateInISO), new Date()) > mins

const result = df.differenceInHours(
  new Date(),
  new Date('2020-04-25T23:04:57.583Z')
)

result

/**
 * Check timezone.
 */

const timezones = JSON.stringify(listTimeZones())

// timezones

const date = new Date()
// const date = new Date('2018-09-01Z16:01:36.386Z')

const format = 'M/D/YYYY HH:mm:ss.SSS [GMT]Z (z)'

const output = dfz.formatToTimeZone(date, format, {
  timeZone: 'America/New_York',
})
// const output = dfz.formatToTimeZone(date, format, { timeZone: 'EST' })

output

const date1 = new Date()
const date2 = new Date()

const dates = [date1]

// const bool = df.isSameDay()

// bool
