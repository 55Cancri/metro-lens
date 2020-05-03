// @ts-nocheck
import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useRegisterUserMutation } from '../types/apollo-hooks'

const pageVariants = {
  initial: { scale: 0.9, opacity: 0 },
  enter: { scale: 1, opacity: 1 },
  exit: {
    scale: 0.5,
    opacity: 0,
    transition: { duration: 1.5 },
  },
}

export const RegisterPage: React.FC = () => {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [email, setEmail] = React.useState('')

  const [registerUserMutation, { data }] = useRegisterUserMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    console.log(
      `Sending with username: ${username}, email: ${email}, password: ${password}.`
    )

    // make graphql api call
    const { data: response } = await registerUserMutation({
      variables: { input: { email, password, username } },
    })

    console.log({ mutationResponse: response })
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="exit"
      animate="enter"
      exit="exit"
    >
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
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
          <label htmlFor="email">
            Email
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
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
        <button type="submit">Register</button>
      </form>
      <p>
        {username} {password}
      </p>
      <Link to="login">Login</Link>
    </motion.div>
  )
}
