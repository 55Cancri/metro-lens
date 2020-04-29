import React from 'react'
// import { ApolloLink } from 'apollo-link'
// import { createHttpLink } from 'apollo-link-http'
// import ApolloClient from 'apollo-client'
// import { InMemoryCache } from 'apollo-cache-inmemory'
// import { createAuthLink } from 'aws-appsync-auth-link'
// import { createSubscriptionHandshakeLink } from 'aws-appsync-subscription-link'

import { Router } from './routes/router'

// const url = appSyncConfig.aws_appsync_graphqlEndpoint;
// const region = appSyncConfig.aws_appsync_region;
// const auth = {
//   type: appSyncConfig.aws_appsync_authenticationType,
//   apiKey: appSyncConfig.aws_appsync_apiKey,
// };

// const httpLink = createHttpLink({ uri: url });

// const link = ApolloLink.from([
//   createAuthLink({ url, region, auth }),
//   createSubscriptionHandshakeLink(url, httpLink)
// ]);

// const client = new ApolloClient({
//   link,
//   cache: new InMemoryCache()
// })

export const App: React.FC = () => <Router />
