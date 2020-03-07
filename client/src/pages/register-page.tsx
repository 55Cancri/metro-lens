import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const pageVariants = {
  initial: { scale: 0.9, opacity: 0 },
  enter: { scale: 1, opacity: 1 },
  exit: {
    scale: 0.5,
    opacity: 0,
    transition: { duration: 1.5 }
  }
}

export const RegisterPage: React.FC = () => (
  <motion.div
    variants={pageVariants}
    initial="exit"
    animate="enter"
    exit="exit"
  >
    <h1>Register</h1>
    <p>Form here</p>
    <Link to="login">Login</Link>
  </motion.div>
)
