import React from 'react'
import { Route, Redirect, RouteProps } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as UserContext from '../context/user-context'

/**
 * A wrapper for <Route> that redirects to the login
 * screen if you're not yet authenticated.
 * @param param0
 */
export const PrivateRoute: React.FC<RouteProps> = ({ children, ...rest }) => {
  /* extract the value of the access token from the context */
  const [{ accessToken }] = UserContext.useUser()

  /* determine if the user is authenticated */
  // TODO: verify expiration of token
  const isAuthenticated = accessToken && accessToken.length > 0

  console.log({ isAuthenticated })
  if (!isAuthenticated) {
    console.log('Redirecting to login.')
  }

  return (
    <Route
      {...rest}
      render={({ location }) =>
        isAuthenticated ? (
          children
        ) : (
          <motion.div exit="undefined">
            <Redirect to={{ pathname: '/login', state: { from: location } }} />
          </motion.div>
        )
      }
    />
  )
}
