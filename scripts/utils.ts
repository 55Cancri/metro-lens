import util from 'util'

/**
 * Log the full output of an item.
 * @param item
 */
export const trace = (item: unknown) =>
  console.log(util.inspect(item, false, null, true))

/**
 * Get the size of an object in bytes.
 * Note: It doesn't calculate how much the object itself takes, only its value.
 * All objects take more space than just their value, otherwise `typeof` would not work.
 * @param value
 */
const sizeOf = (value: any): number => {
  const typeSizes = {
    undefined: () => 0,
    boolean: () => 4,
    number: () => 8,
    string: (item: string) => 2 * item.length,
    object: <T extends Record<string, unknown>>(item: T): number =>
      !item
        ? 0
        : Object.keys(item).reduce(
            (total, key) => sizeOf(key) + sizeOf(item[key]) + total,
            0
          ),
  }

  return typeSizes[typeof value as keyof typeof typeSizes](value)
}

/**
 * Take a raw byte number and format it to its closest byte unit.
 * @param bytes
 * @param decimals
 * @units `"Bytes"`, `"KB"`, `"MB"`, `"GB"`, `"TB"`, `"PB"`, `"EB"`, `"ZB"`, `"YB"`
 *
 */
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Log the size of a value in KB - TB+.
 * @param object
 */
export const byteSize = (object: unknown) => formatBytes(sizeOf(object))

/**
 * Partition an array based on a predicate function.
 * The first array will contain the items that passed the predicate test.
 * @param list
 * @param predicate
 * @example
 * const orders = [{ pending: true }, { pending: false }, { pending: true }]
 * const isConfirmed = (item) => !item.pending
 * const [confirmedOrders, pendingOrders] = partition(orders, isConfirmed)
 *
 */
export const partition = <T>(list: T[], predicate: Function) =>
  list.reduce(
    ([truthyList, falsyList], item) =>
      predicate(item) === true
        ? [[...truthyList, item], falsyList]
        : [truthyList, [...falsyList, item]],
    [[], []] as T[][]
  )

/**
 * Chunk an array into smaller pieces.
 * @param arr array to chunk
 * @param size the size of each chunked array
 */
export const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  )

/**
 * Sleep for `x` milliseconds.
 * @param seconds
 */
export const sleep = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000))
