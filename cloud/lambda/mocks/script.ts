// @ts-nocheck
import { promises as fs } from 'fs'
import { buses } from './buses'

const main = async () => {
  const updatedItems = buses.Items.map((item) => {
    const { routes } = item
    const [firstItem] = routes
    if (firstItem.S) {
      const { S } = firstItem
      return { ...item, routes: [S] }
    }

    return item
  })

  const content = { Items: updatedItems }

  return fs.writeFile('./buses.ts', JSON.stringify(content))
}

main()
  .then(() => console.log('Done.'))
  .catch((error) => console.log(error))
