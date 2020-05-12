import React from 'react'
import { motion } from 'framer-motion'
import { Link, useHistory } from 'react-router-dom'
import { useLoginUserMutation } from '../types/apollo-hooks'
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

export const LoginPage: React.FC = () => {
  /* initialize context */
  const [, userDispatch] = UserContext.useUser()

  /* define local state */
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')

  /* initialize graphql mutation */
  const [loginUserMutation] = useLoginUserMutation()

  /* initialize route history */
  const history = useHistory()

  const handleSubmit = async (e: React.FormEvent) => {
    /* disable page reload on submit */
    e.preventDefault()

    try {
      /* make graphql api call */
      const { data } = await loginUserMutation({
        variables: { input: { username, password } },
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
      <h1>Login page</h1>
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
        <button type="submit">Login</button>
      </form>
      <Link to="register">Register</Link>
    </motion.div>
  )
}
