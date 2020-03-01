import React from "react"
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

const App = () => {
  const { period, image } = getDayPeriod()
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p style={{ fontSize: 84, padding: 0, margin: 0 }}>{image}</p>
        <h1>Good {period} Mommy, this will be a website soon!</h1>
        <p>Please let me know if you saw this message.</p>
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
