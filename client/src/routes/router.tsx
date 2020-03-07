import React from 'react'
import { BrowserRouter, Switch, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Pages from '../pages'

export const Router = () => (
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
            <Route exact path="/dashboard">
              <Pages.DashboardPage />
            </Route>
          </Switch>
        </AnimatePresence>
      )}
    />
  </BrowserRouter>
)
