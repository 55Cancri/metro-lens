import React from 'react'
import { BrowserRouter, Switch, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { PrivateRoute } from './private-route'
import * as Pages from '../pages'

export const Router = () => {
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
