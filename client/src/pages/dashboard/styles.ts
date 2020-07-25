import * as colors from "../../constants/colors"

export const layout: Styles = { padding: 0, margin: 0 }

export const map: Styles = {
  height: "100vh",
  width: "100vw",
  zIndex: 0,
  filter: "brightness(0.9)",
}

export const header: Styles = {
  display: "grid",
  position: "absolute",
  left: 0,
  top: 0,
  padding: 25,
  width: "100vw",
  justifyItems: "center",
  /* prevents overflow */
  boxSizing: "border-box",
  pointerEvents: "none",
  zIndex: 10,
}

export const form: Styles = {
  width: "50%",
  pointerEvents: "all",
}

export const input: Styles = {
  display: "grid",
  position: "relative",
  alignItems: "center",
  input: {
    display: "grid",
    height: 40,
    width: "100%",
    padding: "4px 34px",
    borderRadius: 8,
    fontSize: "large",
    color: colors.grey75,
    border: `2px solid ${colors.white}`,
    boxSizing: "border-box",
    outline: 0,
    filter: "drop-shadow(0 5px 5px rgb(0, 0, 0, .3))",
    backgroundColor: colors.white,
    "&:focus": {
      border: `2px solid ${colors.lightBlue}`,
    },
    "&:focus + span": {
      color: colors.lightBlue,
    },
  },
  span: {
    position: "absolute",
    color: colors.grey45,
    left: 10,
    zIndex: 100,
  },
}

export const refocus: Styles = {
  display: "grid",
  alignItems: "center",
  justifyItems: "center",
  position: "absolute",
  right: 35,
  bottom: 35,
  height: 35,
  width: 35,
  border: 0,
  borderRadius: 8,
  backgroundColor: colors.white,
  zIndex: 10,
  "&:hover": {
    transition: "all 300ms ease-in-out",
    cursor: "pointer",
    backgroundColor: colors.grey15,
  },
}
