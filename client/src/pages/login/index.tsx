/** @jsx jsx */
import React from "react"
import { jsx } from "@emotion/core"
import { motion } from "framer-motion"
import { Link, useHistory } from "react-router-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useLoginUserMutation } from "../../types/apollo-hooks"
import * as UserContext from "../../context/user-context"
import * as styles from "./styles"

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
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")

  /* initialize graphql mutation */
  const [loginUserMutation] = useLoginUserMutation()

  /* initialize route history */
  const history = useHistory()

  const handleSubmit = async (e: React.FormEvent) => {
    /* disable page reload on submit */
    e.preventDefault()

    if (!username && !password) {
      return setError("Fields must not be empty.")
    }

    try {
      /* make graphql api call */
      const { data } = await loginUserMutation({
        variables: { input: { username, password } },
      })

      if (data) {
        /* clear error message */
        setError("")

        /* extract the credentials from the response */
        const { results: credentials } = data

        /* update the global store */
        userDispatch({ type: "login", credentials })

        /* store the jwt in local storage */
        localStorage.setItem("jwt", credentials.accessToken)

        /* redirect to dashboard page */
        history.push("/dashboard")
      }
    } catch (errors) {
      if ("graphQLErrors" in errors) {
        const { graphQLErrors, message } = errors
        if (graphQLErrors.length > 0) {
          const [graphqlError] = graphQLErrors
          const { message } = graphqlError
          /* reset input fields on error */
          setUsername("")
          setPassword("")
          return setError(message)
        }
        /* reset input fields on error */
        setUsername("")
        setPassword("")
        return setError(message)
      }

      const defaultMessage = "An unknown error occurred"
      return setError(defaultMessage)
    }
  }

  return (
    <motion.div
      css={styles.layout}
      variants={pageVariants}
      initial="exit"
      animate="enter"
      exit="exit"
    >
      <main>
        <aside>
          <span>
            <FontAwesomeIcon icon="map-marked" color="white" size="2x" />
          </span>
          <h1>Coordinate</h1>
        </aside>
        <form onSubmit={handleSubmit}>
          <section>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              autoComplete="off"
              onChange={(e) => setUsername(e.currentTarget.value)}
            />
          </section>
          <section>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
          </section>
          <section>
            <button type="submit">Login</button>
            {error && <span className="error">{error}</span>}
            <p>
              <span>Need an account? </span>
              <Link to="register">Register</Link>
            </p>
          </section>
        </form>
      </main>
    </motion.div>
  )
}
