import chalk from 'chalk'
import logger from 'winston'
import * as time from 'date-fns'

// @ts-ignore
import { format as SAFE_format } from 'logform/dist/browser'

const format = SAFE_format as typeof logger.format

const myFormat = format.printf(({ level, message, label, timestamp }) => {
  const now = time.format(new Date(timestamp), 'yyyy-MM-dd hh:mm:ssa')
  // const stamp = chalk.bold.green(`[${now}m]:`)
  return `[ ${now} ] ${level}: ${JSON.stringify(message, null, 2)}`
})

export const winston = logger.createLogger({
  format: format.combine(
    // format.label({ label: 'Sup' }),
    format.timestamp(),
    myFormat
  ),
  transports: [new logger.transports.Console()],
})
