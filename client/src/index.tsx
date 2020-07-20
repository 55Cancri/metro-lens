import React from "react"
import ReactDOM from "react-dom"
import { library } from "@fortawesome/fontawesome-svg-core"
import { faSearch, faLocationArrow } from "@fortawesome/free-solid-svg-icons"
import { App } from "./pages/app"

library.add(faSearch, faLocationArrow)

ReactDOM.render(<App />, document.getElementById("root"))
