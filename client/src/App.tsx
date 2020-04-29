import React from 'react'
import { ApolloLink } from 'apollo-link'
import { createHttpLink } from 'apollo-link-http'
import ApolloClient from 'apollo-client'
import { InMemoryCache } from 'apollo-cache-inmemory'
import { createAuthLink } from 'aws-appsync-auth-link'
import { createSubscriptionHandshakeLink } from 'aws-appsync-subscription-link'

import { Router } from './routes/router'

export const App: React.FC = () => <Router />
