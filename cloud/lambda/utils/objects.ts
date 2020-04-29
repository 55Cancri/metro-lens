/**
 * Get the size of an object in bytes.
 * Note: It doesn't calculate how much the object itself takes, only its value.
 * All objects take more space than just their value, otherwise `typeof` would not work.
 * @param value
 */
export const sizeOf = (value: any): number => {
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
 * Determine if an object is empty or not.
 * @param obj an object to inspect emptiness.
 */
export const objectIsEmpty = (obj = {}) =>
  !Object.is(obj, null) && Object.keys(obj).length === 0
