/** @jsx jsx */
import React from "react"
import { jsx } from "@emotion/core"
import { motion } from "framer-motion"
import { Input } from "./input"
import * as styles from "../styles"

export const Header: React.FC = () => (
  <motion.div css={styles.header}>
    {/* <h2>Home to Dunn-Loring</h2> */}
    <Input />
  </motion.div>
)
