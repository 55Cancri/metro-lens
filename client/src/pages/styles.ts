import { mq } from "../constants/media-queries"
import color from "color"
// import * as colors from "../../constants/colors"

// const lime = "#77ff94"
const lime = "#7cf897"
const focusBorder = `3px solid ${color(lime)
  .desaturate(0.5)
  .darken(0.4)
  .string()}`

export const layout = mq({
  display: "grid",
  alignItems: "center",
  justifyItems: "center",
  height: "100vh",
  backgroundColor: lime,
  main: {
    display: "grid",
    alignContent: "center",
    justifyItems: "center",
    gridRowGap: 35,
    height: ["100vh", "70vh"],
    width: ["100%", "65vw", "55vw", "600px"],
    margin: 0,
    padding: [25, 55],
    borderRadius: 4,
    backgroundColor: "#211e1c",
    filter: "drop-shadow(0 5px 4px rgb(0, 0, 0, .6))",
    aside: {
      display: "grid",
      alignSelf: "center",
      justifyItems: "center",
      gridRowGap: 8,
      h1: {
        margin: 0,
        padding: 0,
        letterSpacing: ".2rem",
        textTransform: "uppercase",
        color: "darkgray",
      },
    },
    form: {
      display: "grid",
      gridRowGap: 18,
      width: "100%",
      section: {
        display: "grid",
        gridRowGap: 8,
        label: {
          color: "darkgray",
        },
        input: {
          height: 45,
          padding: "5px 15px",
          border: "3px solid transparent",
          borderRadius: 4,
          background: 0,
          outline: 0,
          backgroundColor: "#fff",
          "&:focus": {
            border: focusBorder,
          },
        },
        button: {
          height: 45,
          marginTop: 24,
          borderRadius: 4,
          border: "3px solid transparent",
          outline: 0,
          fontWeight: 600,
          backgroundColor: lime,
          transition: "250ms all ease-in-out",
          "&:focus": {
            border: focusBorder,
          },
          "&:hover": {
            backgroundColor: color(lime).desaturate(0.4).darken(0.1).string(),
            cursor: "pointer",
          },
        },
      },
      ".error": {
        color: "#db5461",
      },
      p: {
        color: "darkgray",
      },
      a: {
        fontWeight: 600,
        textDecoration: 0,
        color: lime,
        "&:focus": {
          border: "4px solid red",
        },
        "&:visited, &:hover": {
          color: lime,
          textDecoration: "underline",
        },
      },
    },
  },
} as Styles)
