/** @jsx jsx */
import React from "react"
import { jsx } from "@emotion/core"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import * as styles from "../styles"

export const Input: React.FC = () => {
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log("Submit.")
  }

  return (
    <form css={styles.form} onSubmit={onSubmit}>
      <div css={styles.input}>
        <input placeholder="Search..." />
        <span>
          <FontAwesomeIcon icon="search" />
        </span>
      </div>
    </form>
  )
}
