/** @jsx jsx */
import React from 'react'
import { jsx } from '@emotion/core'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const styles: Styles = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gridGap: 15,
  a: {
    padding: 8,
    border: 0,
    borderRadius: 5,
    outline: 0,
    textDecoration: 'none',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    '&:nth-of-type(1)': {
      backgroundColor: 'darkgrey'
    },
    '&:nth-of-type(2)': {
      backgroundColor: 'dodgerblue'
    },
    '&:nth-of-type(3)': {
      backgroundColor: 'midnightblue'
    },
    '&:hover': {
      cursor: 'pointer',
      filter: 'brightness(.92)',
      transition: '200ms all ease-in-out'
    }
  }
}

const pageVariants = {
  initial: { scale: 0.9, opacity: 0 },
  enter: { scale: 1, opacity: 1 },
  exit: {
    scale: 0.5,
    opacity: 0,
    transition: { duration: 1.5 }
  }
}

export const SplashPage: React.FC = () => (
  <motion.div
    variants={pageVariants}
    initial="exit"
    animate="enter"
    exit="exit"
  >
    <h1>Metro lens</h1>
    <p>Track NOVA bus and rail services.</p>
    <div css={styles}>
      <Link to="/login">Login</Link>
      <Link to="/register">Register</Link>
      <Link to="/dashboard">Dashboard</Link>
    </div>
  </motion.div>
)
