import React from "react"
import ReactDOM from "react-dom"
import { library } from "@fortawesome/fontawesome-svg-core"
import {
  faSearch,
  faMapPin,
  faMapMarked,
} from "@fortawesome/free-solid-svg-icons"
import WebFont from "webfontloader"
import { App } from "./pages/app"

WebFont.load({
  google: {
    families: ["Mulish:300,400,700", "sans-serif"],
  },
})

library.add(faSearch, faMapPin, faMapMarked)

ReactDOM.render(<App />, document.getElementById("root"))
