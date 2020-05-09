import React from 'react'
import { ApolloLink } from 'apollo-link'
import { createHttpLink } from 'apollo-link-http'
import ApolloClient from 'apollo-client'
import { ApolloProvider } from '@apollo/react-hooks'
import { InMemoryCache } from 'apollo-cache-inmemory'
import { createAuthLink, AuthOptions } from 'aws-appsync-auth-link'
import { createSubscriptionHandshakeLink } from 'aws-appsync-subscription-link'

import { Router } from './routes/router'

const appsync = {
  aws_appsync_region: 'us-east-1',
  aws_appsync_authenticationType: 'API_KEY',
  aws_appsync_graphqlEndpoint:
    'https://yo7d35ksxjexvjrvtb6q6edmgy.appsync-api.us-east-1.amazonaws.com/graphql',
  aws_appsync_apiKey: 'da2-7ozvq2r43nck5mf4yxmkze5sdm',
}

const url = appsync.aws_appsync_graphqlEndpoint
const region = appsync.aws_appsync_region
const auth = {
  type: appsync.aws_appsync_authenticationType,
  apiKey: appsync.aws_appsync_apiKey,
} as AuthOptions

const httpLink = createHttpLink({ uri: url })

const link = ApolloLink.from([
  createAuthLink({ url, region, auth }),
  createSubscriptionHandshakeLink(url, httpLink),
])

const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
})

export const App: React.FC = () => (
  <ApolloProvider client={client}>
    <Router />
  </ApolloProvider>
)
