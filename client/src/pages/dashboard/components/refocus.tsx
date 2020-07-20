/** @jsx jsx */
import React from "react"
import { jsx } from "@emotion/core"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import * as styles from "../styles"

type Props = {
  onClick: () => void
}

export const Refocus: React.FC<Props> = (props) => (
  <button css={styles.refocus} onClick={props.onClick}>
    <FontAwesomeIcon icon="location-arrow" size="lg" />
  </button>
)
