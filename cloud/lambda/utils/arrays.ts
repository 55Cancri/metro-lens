/**
 * Guard against spreading undefined values.
 * @param arr array to chunk
 */
export const defaultSpread = <T>(arr: T[] | undefined): T[] =>
  typeof arr === 'undefined' ? [] : arr

/**
 * Chunk an array into smaller pieces.
 * @param arr array to chunk
 * @param size the size of each chunked array
 */
export const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  )
