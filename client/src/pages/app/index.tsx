import React from "react"
import { ApolloLink } from "apollo-link"
import { createHttpLink } from "apollo-link-http"
import ApolloClient from "apollo-client"
import { ApolloProvider } from "@apollo/react-hooks"
import { InMemoryCache } from "apollo-cache-inmemory"
import { createAuthLink, AuthOptions } from "aws-appsync-auth-link"
import { createSubscriptionHandshakeLink } from "aws-appsync-subscription-link"
import * as AppContext from "../../context/app-context"
import * as UserContext from "../../context/user-context"
import { Global } from "@emotion/core"
import { appsync } from "../../credentials"
import * as styles from "./styles"

import { Router } from "../../routes/router"

const url = appsync.aws_appsync_graphqlEndpoint
const region = appsync.aws_appsync_region
const auth = {
  type: appsync.aws_appsync_authenticationType,
  apiKey: appsync.aws_appsync_apiKey,
} as AuthOptions

const authLink = createAuthLink({ url, region, auth })
const subscriptionLink = createSubscriptionHandshakeLink({ url, region, auth })
const link = ApolloLink.from([authLink, subscriptionLink])
const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
})

export const App: React.FC = () => (
  <ApolloProvider client={client}>
    <AppContext.AppProvider>
      <UserContext.UserProvider>
        <Global styles={styles.global} />
        <Router />
      </UserContext.UserProvider>
    </AppContext.AppProvider>
  </ApolloProvider>
)
