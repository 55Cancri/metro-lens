import { promises as fs } from 'fs'

const main = async () => {
  const raw = await fs.readFile('./metro-table-data.json', {
    encoding: 'utf8',
  })

  console.log(Array.isArray(raw))
}

const done = () => console.log('Done.')
const error = (error: Error) => console.error(error)

main().then(done).catch(error)
