// /**
//  * Safely append potentially undefined variables to an array.
//  * @param initialList
//  * @param args
//  */
// export const safeMerge = (
//   initialList: (infer T)[],
//   ...args: (infer K)[]
// ): (T | K)[] => args.reduce((store, arg) => store.concat(item), initialList)

// export const dedupe = (list1: (infer T)[], list2: (infer K)[]) => {
export const dedupe = (list1: any[], list2: any[]) => {
  const unique = new Map()
  list1.concat(list2).forEach((item) => unique.set(item.lat, item))
  return Array.from(unique.values())
}
