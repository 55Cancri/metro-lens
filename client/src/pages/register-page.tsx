import React from 'react'
import { Link, useHistory } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useRegisterUserMutation } from '../types/apollo-hooks'
import * as UserContext from '../context/user-context'

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
  /* initialize context */
  const [, userDispatch] = UserContext.useUser()

  /* define local state */
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [error, setError] = React.useState('')

  /* initialize graphql mutation */
  const [registerUserMutation] = useRegisterUserMutation()

  /* initialize route history */
  const history = useHistory()

  const handleSubmit = async (e: React.FormEvent) => {
    /* disable page reload on submit */
    e.preventDefault()

    try {
      // make graphql api call
      const { data } = await registerUserMutation({
        variables: { input: { email, password, username } },
      })

      if (data) {
        /* clear error message */
        setError('')

        /* extract the credentials from the response */
        const { results: credentials } = data

        /* update the global store */
        userDispatch({ type: 'login', credentials })

        /* redirect to dashboard page */
        history.push('/dashboard')
      }
    } catch (errors) {
      const [graphqlError] = errors.graphQLErrors
      const { message } = graphqlError
      /* reset input fields on error */
      setUsername('')
      setPassword('')
      return setError(message)
    }
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
        {error && <p>{error}</p>}
        <button type="submit">Register</button>
      </form>
      <Link to="login">Login</Link>
    </motion.div>
  )
}
