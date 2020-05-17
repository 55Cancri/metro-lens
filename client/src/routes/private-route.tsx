import React from 'react'
import { Route, Redirect, RouteProps } from 'react-router-dom'
import { motion } from 'framer-motion'
import decode from 'jwt-decode'

import * as UserContext from '../context/user-context'
import * as objectUtils from '../utils/objects'
import * as Iam from '../../../shared/types/iam'

/**
 * A wrapper for <Route> that redirects to the login
 * screen if you're not yet authenticated.
 * @param param0
 */
export const PrivateRoute: React.FC<RouteProps> = ({ children, ...rest }) => {
  /* initialize context and the get user context */
  const [userState, userDispatch] = UserContext.useUser()

  /* store the jwt in local storage */
  const localAccessToken = localStorage.getItem('jwt')

  /* determine if the context is empty */
  const contextIsEmpty = objectUtils.objectIsEmpty(userState)

  /* if the jwt exists and the context is empty (occurs on refresh), */
  if (localAccessToken && contextIsEmpty) {
    /* decode jwt */
    const user = decode(localAccessToken) as Iam.User

    /* create the credentials object */
    const credentials = { user, accessToken: localAccessToken }

    /* update the global store */
    userDispatch({ type: 'login', credentials })

    /* and display nothing for a second until context
    repopulates and the component re-renders */
    return <React.Fragment />
  }

  /* determine if the user is authenticated */
  // TODO: verify expiration of token
  const isAuthenticated =
    userState.accessToken && userState.accessToken.length > 0

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
