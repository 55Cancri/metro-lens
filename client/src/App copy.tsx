import React, { useEffect, useState } from "react"
import axios from "axios"
import logo from "./logo.svg"
import "./App.css"

const getDayPeriod = () => {
  const currentHour = new Date().getHours()
  if (currentHour <= 11) return { period: "morning", image: "🌅" }
  if (currentHour <= 16) return { period: "afternoon", image: "🏙" }
  if (currentHour <= 20) return { period: "evening", image: "🌇" }
  if (currentHour <= 24) return { period: "night", image: "🌃" }
  return { period: "", image: "" }
}

const wmataPrimaryKey = "cd6f240fe8e845b2b3cc4a3d824513b2"
const wmataSecondaryKey = "0d73e33778874aa9a8c55c47c2f38c5f"
const connectorKey = "knEZ3gqEcF3Y9vgpujB8eCixa"

const App = () => {
  const [predictions, setPredictions] = useState({})

  const { period, image } = getDayPeriod()

  const makeCalls = async () => {
    const wmata = await axios.get(
      "https://api.wmata.com/Bus.svc/json/jRoutes",
      {
        headers: { api_key: wmataPrimaryKey },
      }
    )

    /**
     * rt: "401", rtnm: "Backlick - Gallows Road Line", (dir=North)
     *  getstops = /getstops?rt=401&dir=North
     *    stpid: "2101", stpnm: "Gallows Rd and Lee Hwy", (+lat&lon)
     *    stpid: "6489", stpnm: "Tysons Corner Metro Bay F", (+lat&lon)
     *
     * rt: "402", rtnm: "Tysons-Gallows-Springfield Line", (dir=South)
     *  getstops = /getstops?rt=402&dir=South
     *    stpid: "2101", stpnm: "Gallows Rd and Lee Hwy", (+lat&lon)
     *    stpid: "6489", stpnm: "Tysons Corner Metro Bay F", (+lat&lon)
     *
     *
     * rt: "505", rtnm: "Reston Town Center - Wiehle", (dir=East|West)
     * rt: "983", rtnm: "Wiehle - Dulles Airport", (dir=East|West)
     *
     */
    const connector = await axios.get(
      `https://www.fairfaxcounty.gov/bustime/api/v3/getpredictions`,
      {
        headers: { "Content-Type": "application/json" },
        params: {
          key: connectorKey,
          format: "json",
          stpid: 2101,
          // stopid: 2101,
          // rt: "402",
          // dir: "North",
        },
      }
    )

    console.log(connector.data)

    return { wmata, connector }
  }

  useEffect(() => {
    const data = makeCalls()
      .then(results => setPredictions(results))
      .catch(error => console.error(error))
  })

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p style={{ fontSize: 84, padding: 0, margin: 0 }}>{image}</p>
        <h1>Metro Lens</h1>
        <p>Track bus and metro location.</p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          More React
        </a>
      </header>
    </div>
  )
}

export default App
