/**
 * Partition an array based on a predicate function.
 * @param array
 * @param predicate
 * @example
 * const orders = [{ pending: true }, { pending: false }, { pending: true }]
 * const predicate = (item) => item.pending
 * const [pendingOrders, confirmedOrders] = partition(orders, predicate)
 *
 */
export const partition = <T>(array: T[], predicate: Function) =>
  array.reduce(
    ([truthyList, falsyList], item) =>
      predicate(item) === true
        ? [[...truthyList, item], falsyList]
        : [truthyList, [...falsyList, item]],
    [[], []] as T[][]
  )

/**
 * Create an array of a specific size with any kind of value to iterator.
 * @param size
 * @param placeholder
 */
export const createList = (size: number, placeholder = 0): unknown[] =>
  [...new Array(size)].map(() => placeholder)

/**
 * Guard against spreading undefined values.
 * @param arr array to chunk
 */
export const defaultSpread = <T>(arr: T[] | undefined): T[] =>
  typeof arr === "undefined" ? [] : arr

/**
 * Chunk an array into smaller pieces.
 * @param list array to chunk
 * @param size the size of each chunked array
 */
export const chunk = <T>(list: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, i * size + size)
  )
