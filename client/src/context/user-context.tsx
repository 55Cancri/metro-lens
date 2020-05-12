import React from 'react'
import * as Iam from '../../../shared/types/iam'

/* define the possible action types */
type Action =
  | { type: 'login'; credentials: Iam.Credentials }
  | { type: 'logout' }

/* define the dispatch function */
type Dispatch = (action: Action) => void

/* define the context state */
type State = Partial<Iam.Credentials>

/* define a context for the app state and dispatch */
const UserStateContext = React.createContext<State | undefined>(undefined)
const UserDispatchContext = React.createContext<Dispatch | undefined>(undefined)

const userReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'login': {
      return { ...state, ...action.credentials }
    }

    case 'logout': {
      return {}
    }

    default: {
      throw new Error(`Unhandled action type: ${(action as Action).type}.`)
    }
  }
}

export const UserProvider: React.FC = ({ children }) => {
  /* define the initial state */
  const initialState = {} as State

  /* track the state for the UserContext using use reducer */
  const [state, dispatch] = React.useReducer(userReducer, initialState)

  /**
   * Provide the dispatch and state from useReducer for use
   * by child components using UserContext.
   */
  return (
    <UserStateContext.Provider value={state}>
      <UserDispatchContext.Provider value={dispatch}>
        {children}
      </UserDispatchContext.Provider>
    </UserStateContext.Provider>
  )
}

const useUserState = () => {
  /**
   * Ultimately, this context will be loaded with the state variable
   * provided by the useReducer above. This happens in the UserProvider
   * on page mount when the UserContext.UserProvider wraps the app and
   * receives the state variable as its value.
   */
  const context = React.useContext(UserStateContext)
  /**
   * If there is no value, then we throw a helpful error message
   * indicating that the hook is not being called within a function
   * component that is rendered within a UserProvider. This is
   * most certainly a mistake, so providing the error message is
   * valuable. #FailFast
   */
  if (context === undefined) {
    throw new Error('useUserState must be used within an UserProvider.')
  }
  return context
}

const useUserDispatch = () => {
  /**
   * Ultimately, this context will be loaded with the dispatch function
   * provided by the useReducer above. This happens in the UserProvider
   * on page mount when the UserContext.UserProvider wraps the app and
   * receives the dispatch function as its value.
   */
  const context = React.useContext(UserDispatchContext)
  /**
   * If there is no value, then throw a helpful error message
   * indicating that the hook is not being called within a function
   * component that is rendered within a UserProvider. This is
   * most certainly a mistake, so providing the error message is
   * valuable. #FailFast
   */
  if (context === undefined) {
    throw new Error('useUserDispatch must be used within an UserProvider.')
  }
  return context
}

/**
 * Instead exporting and initializing the UserContext state and dispatch
 * separately, call them here and export the state and dispatch in an array.
 */
export const useUser = () => {
  const state = useUserState()
  const dispatch = useUserDispatch()
  return [state, dispatch] as [State, Dispatch]
}
