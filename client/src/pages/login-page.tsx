import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const pageVariants = {
  initial: { scale: 0.9, opacity: 0 },
  enter: { scale: 1, opacity: 1 },
  exit: {
    scale: 0.5,
    opacity: 0,
    transition: { duration: 1.5 },
  },
}

export const LoginPage: React.FC = () => {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')

  return (
    <motion.div
      variants={pageVariants}
      initial="exit"
      animate="enter"
      exit="exit"
    >
      <h1>Login page</h1>
      <form>
        <div>
          <label htmlFor="username">
            Username
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
            />
          </label>
        </div>
        <div>
          <label htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
          </label>
        </div>
      </form>
      <p>
        {username} {password}
      </p>
      <Link to="register">Register</Link>
    </motion.div>
  )
}
