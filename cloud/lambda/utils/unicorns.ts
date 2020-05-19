import chalk from 'chalk'
import logger from 'winston'
import * as dfz from 'date-fns-timezone'
import util from 'util'

import { format as SAFE_format } from 'logform/dist/browser'

const format = SAFE_format as typeof logger.format

// sleep for x milliseconds
export const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

export const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

const myFormat = format.printf(({ level, message, label, timestamp }) => {
  const now = dfz.formatToTimeZone(
    new Date(timestamp),
    'YYYY-MM-DD hh:mm:ssa',
    { timeZone: 'America/New_York' }
  )
  // const stamp = chalk.bold.green(`[${now}m]:`)
  return `[${now}] ${level}: ${JSON.stringify(message, null, 2)}`
})

export const winston = logger.createLogger({
  format: format.combine(
    // format.label({ label: 'Sup' }),
    format.timestamp(),
    myFormat
  ),
  transports: [new logger.transports.Console()],
})

/**
 * Print the entire contents to the lambda logs.
 *
 * @param item
 */
export const print = (item: unknown) =>
  console.log(JSON.stringify(item, null, 2))

const trace = (item: unknown) =>
  console.log(util.inspect(item, false, null, true))

export const is = <T>(value: unknown, condition: boolean): value is T =>
  condition
