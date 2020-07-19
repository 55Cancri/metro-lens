import gql from "graphql-tag"
import * as ApolloReactCommon from "@apollo/react-common"
import * as ApolloReactHooks from "@apollo/react-hooks"
export type Maybe<T> = T
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string
  String: string
  Boolean: boolean
  Int: number
  Float: number
}

export type RegisterInput = {
  username: Scalars["String"]
  email: Scalars["String"]
  password: Scalars["String"]
}

export type LoginInput = {
  username: Scalars["String"]
  password: Scalars["String"]
}

export type VehicleInput = {
  predictionGroupId: Scalars["String"]
}

export type FavoriteStop = {
  __typename?: "FavoriteStop"
  stopId: Scalars["String"]
  stopName: Scalars["String"]
  userLabel: Scalars["String"]
}

export type Location = {
  __typename?: "Location"
  lat: Scalars["Int"]
  lon: Scalars["Int"]
}

export type User = {
  __typename?: "User"
  uuid: Scalars["ID"]
  email: Scalars["String"]
  username: Scalars["String"]
  password: Scalars["String"]
  status: Scalars["Boolean"]
  dateCreated: Scalars["String"]
  lastSignOn: Scalars["String"]
  favoriteStops: Array<Maybe<FavoriteStop>>
  locations: Array<Maybe<Location>>
}

export type LoginResponse = {
  __typename?: "LoginResponse"
  accessToken: Scalars["String"]
  user: User
}

export type Prediction = {
  __typename?: "Prediction"
  arrivalIn: Scalars["String"]
  arrivalTime: Scalars["String"]
  stopId: Scalars["String"]
  stopName: Scalars["String"]
}

export type Vehicle = {
  __typename?: "Vehicle"
  vehicleId: Scalars["String"]
  rt: Scalars["String"]
  lat: Scalars["String"]
  lon: Scalars["String"]
  lastUpdateTime: Scalars["String"]
  predictions: Array<Prediction>
}

export type Test = {
  __typename?: "Test"
  name: Scalars["String"]
  age: Scalars["String"]
}

export type Query = {
  __typename?: "Query"
  getUser?: Maybe<User>
  getUsers?: Maybe<Array<Maybe<User>>>
}

export type QueryGetUserArgs = {
  id: Scalars["ID"]
}

export type Mutation = {
  __typename?: "Mutation"
  registerUser: LoginResponse
  loginUser: LoginResponse
  updateVehiclePositions?: Maybe<Array<Vehicle>>
  testMutation?: Maybe<Test>
}

export type MutationRegisterUserArgs = {
  input: RegisterInput
}

export type MutationLoginUserArgs = {
  input: LoginInput
}

export type MutationUpdateVehiclePositionsArgs = {
  input: VehicleInput
}

export type Subscription = {
  __typename?: "Subscription"
  onUpdateVehiclePositions?: Maybe<Array<Vehicle>>
  testedMutation?: Maybe<Test>
}

export type LoginUserMutationVariables = {
  input: LoginInput
}

export type LoginUserMutation = { __typename?: "Mutation" } & {
  results: { __typename?: "LoginResponse" } & Pick<
    LoginResponse,
    "accessToken"
  > & {
      user: { __typename?: "User" } & Pick<User, "uuid" | "email" | "username">
    }
}

export type RegisterUserMutationVariables = {
  input: RegisterInput
}

export type RegisterUserMutation = { __typename?: "Mutation" } & {
  results: { __typename?: "LoginResponse" } & Pick<
    LoginResponse,
    "accessToken"
  > & {
      user: { __typename?: "User" } & Pick<User, "uuid" | "email" | "username">
    }
}

export type TestedMutationSubscriptionVariables = {}

export type TestedMutationSubscription = { __typename?: "Subscription" } & {
  testedMutation?: Maybe<{ __typename?: "Test" } & Pick<Test, "name" | "age">>
}

export type OnUpdateVehiclePositionsSubscriptionVariables = {}

export type OnUpdateVehiclePositionsSubscription = {
  __typename?: "Subscription"
} & {
  onUpdateVehiclePositions?: Maybe<
    Array<
      { __typename?: "Vehicle" } & Pick<
        Vehicle,
        "vehicleId" | "rt" | "lat" | "lon" | "lastUpdateTime"
      > & {
          predictions: Array<
            { __typename?: "Prediction" } & Pick<
              Prediction,
              "arrivalIn" | "arrivalTime" | "stopId" | "stopName"
            >
          >
        }
    >
  >
}

export const LoginUserDocument = gql`
  mutation loginUser($input: LoginInput!) {
    results: loginUser(input: $input) {
      accessToken
      user {
        uuid
        email
        username
      }
    }
  }
`

/**
 * __useLoginUserMutation__
 *
 * To run a mutation, you first call `useLoginUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLoginUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [loginUserMutation, { data, loading, error }] = useLoginUserMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useLoginUserMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    LoginUserMutation,
    LoginUserMutationVariables
  >
) {
  return ApolloReactHooks.useMutation<
    LoginUserMutation,
    LoginUserMutationVariables
  >(LoginUserDocument, baseOptions)
}
export type LoginUserMutationHookResult = ReturnType<
  typeof useLoginUserMutation
>
export type LoginUserMutationResult = ApolloReactCommon.MutationResult<
  LoginUserMutation
>
export type LoginUserMutationOptions = ApolloReactCommon.BaseMutationOptions<
  LoginUserMutation,
  LoginUserMutationVariables
>
export const RegisterUserDocument = gql`
  mutation registerUser($input: RegisterInput!) {
    results: registerUser(input: $input) {
      accessToken
      user {
        uuid
        email
        username
      }
    }
  }
`

/**
 * __useRegisterUserMutation__
 *
 * To run a mutation, you first call `useRegisterUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRegisterUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [registerUserMutation, { data, loading, error }] = useRegisterUserMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useRegisterUserMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    RegisterUserMutation,
    RegisterUserMutationVariables
  >
) {
  return ApolloReactHooks.useMutation<
    RegisterUserMutation,
    RegisterUserMutationVariables
  >(RegisterUserDocument, baseOptions)
}
export type RegisterUserMutationHookResult = ReturnType<
  typeof useRegisterUserMutation
>
export type RegisterUserMutationResult = ApolloReactCommon.MutationResult<
  RegisterUserMutation
>
export type RegisterUserMutationOptions = ApolloReactCommon.BaseMutationOptions<
  RegisterUserMutation,
  RegisterUserMutationVariables
>
export const TestedMutationDocument = gql`
  subscription testedMutation {
    testedMutation {
      name
      age
    }
  }
`

/**
 * __useTestedMutationSubscription__
 *
 * To run a query within a React component, call `useTestedMutationSubscription` and pass it any options that fit your needs.
 * When your component renders, `useTestedMutationSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTestedMutationSubscription({
 *   variables: {
 *   },
 * });
 */
export function useTestedMutationSubscription(
  baseOptions?: ApolloReactHooks.SubscriptionHookOptions<
    TestedMutationSubscription,
    TestedMutationSubscriptionVariables
  >
) {
  return ApolloReactHooks.useSubscription<
    TestedMutationSubscription,
    TestedMutationSubscriptionVariables
  >(TestedMutationDocument, baseOptions)
}
export type TestedMutationSubscriptionHookResult = ReturnType<
  typeof useTestedMutationSubscription
>
export type TestedMutationSubscriptionResult = ApolloReactCommon.SubscriptionResult<
  TestedMutationSubscription
>
export const OnUpdateVehiclePositionsDocument = gql`
  subscription onUpdateVehiclePositions {
    onUpdateVehiclePositions {
      vehicleId
      rt
      lat
      lon
      lastUpdateTime
      predictions {
        arrivalIn
        arrivalTime
        stopId
        stopName
      }
    }
  }
`

/**
 * __useOnUpdateVehiclePositionsSubscription__
 *
 * To run a query within a React component, call `useOnUpdateVehiclePositionsSubscription` and pass it any options that fit your needs.
 * When your component renders, `useOnUpdateVehiclePositionsSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOnUpdateVehiclePositionsSubscription({
 *   variables: {
 *   },
 * });
 */
export function useOnUpdateVehiclePositionsSubscription(
  baseOptions?: ApolloReactHooks.SubscriptionHookOptions<
    OnUpdateVehiclePositionsSubscription,
    OnUpdateVehiclePositionsSubscriptionVariables
  >
) {
  return ApolloReactHooks.useSubscription<
    OnUpdateVehiclePositionsSubscription,
    OnUpdateVehiclePositionsSubscriptionVariables
  >(OnUpdateVehiclePositionsDocument, baseOptions)
}
export type OnUpdateVehiclePositionsSubscriptionHookResult = ReturnType<
  typeof useOnUpdateVehiclePositionsSubscription
>
export type OnUpdateVehiclePositionsSubscriptionResult = ApolloReactCommon.SubscriptionResult<
  OnUpdateVehiclePositionsSubscription
>
