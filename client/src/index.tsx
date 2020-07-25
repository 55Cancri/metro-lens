import React from "react"
import ReactDOM from "react-dom"
import { library } from "@fortawesome/fontawesome-svg-core"
import { faSearch, faMapPin } from "@fortawesome/free-solid-svg-icons"
import { App } from "./pages/app"

library.add(faSearch, faMapPin)

ReactDOM.render(<App />, document.getElementById("root"))
