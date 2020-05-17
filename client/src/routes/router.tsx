import React from 'react'
import { BrowserRouter, Switch, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import decode from 'jwt-decode'
import * as UserContext from '../context/user-context'
import { PrivateRoute } from './private-route'
import * as Pages from '../pages'
import * as Iam from '../../../shared/types/iam'

export const Router = () => {
  /* initialize context */
  const [, userDispatch] = UserContext.useUser()

  /* store the jwt in local storage */
  const accessToken = localStorage.getItem('jwt')

  if (accessToken) {
    /* decode jwt */
    const user = decode(accessToken) as Iam.User
    const credentials = { user, accessToken }

    /* update the global store */
    userDispatch({ type: 'login', credentials })
  }

  return (
    <BrowserRouter>
      <Route
        render={({ location }) => (
          <AnimatePresence exitBeforeEnter initial={false}>
            <Switch location={location} key={location.key}>
              <Route exact path="/">
                <Pages.SplashPage />
              </Route>
              <Route exact path="/login">
                <Pages.LoginPage />
              </Route>
              <Route exact path="/register">
                <Pages.RegisterPage />
              </Route>
              <PrivateRoute exact path="/dashboard">
                <Pages.DashboardPage />
              </PrivateRoute>
              <Route path="*">
                <Pages.NotFoundPage />
              </Route>
            </Switch>
          </AnimatePresence>
        )}
      />
    </BrowserRouter>
  )
}
