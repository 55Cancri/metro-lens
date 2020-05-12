import React from 'react'

/* define the possible action types */
type Action = { type: 'loading' } | { type: 'login'; token: string }

/* define the dispatch function */
type Dispatch = (action: Action) => void

/* define the context state */
type State = {
  theme: string
  isLoading: boolean
  token: string
}

/* define a context for the app state and dispatch */
const AppStateContext = React.createContext<State | undefined>(undefined)
const AppDispatchContext = React.createContext<Dispatch | undefined>(undefined)

const appReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'loading': {
      return state
    }

    case 'login': {
      return { ...state, token: action.token }
    }
    default: {
      throw new Error(`Unhandled action type: ${(action as Action).type}.`)
    }
  }
}

export const AppProvider: React.FC = ({ children }) => {
  /* define the initial state */
  const initialState = { theme: 'default', isLoading: true, token: '' } as State
  /* track the state for the AppContext using use reducer */
  const [state, dispatch] = React.useReducer(appReducer, initialState)

  /**
   * Provide the dispatch and state from useReducer for use
   * by child components using AppContext.
   */
  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  )
}

const useAppState = () => {
  /**
   * Ultimately, this context will be loaded with the state variable
   * provided by the useReducer above. This happens in the AppProvider
   * on page mount when the AppContext.Provider wraps the app and
   * receives the state variable as its value.
   */
  const context = React.useContext(AppStateContext)
  /**
   * If there is no value, then we throw a helpful error message
   * indicating that the hook is not being called within a function
   * component that is rendered within a AppProvider. This is
   * most certainly a mistake, so providing the error message is
   * valuable. #FailFast
   */
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppProvider.')
  }
  return context
}

const useAppDispatch = () => {
  /**
   * Ultimately, this context will be loaded with the dispatch function
   * provided by the useReducer above. This happens in the AppProvider
   * on page mount when the AppContext.Provider wraps the app and
   * receives the dispatch function as its value.
   */
  const context = React.useContext(AppDispatchContext)
  /**
   * If there is no value, then throw a helpful error message
   * indicating that the hook is not being called within a function
   * component that is rendered within a AppProvider. This is
   * most certainly a mistake, so providing the error message is
   * valuable. #FailFast
   */
  if (context === undefined) {
    throw new Error('useAppDispatch must be used within an AppProvider.')
  }
  return context
}

/**
 * Instead exporting and initializing the AppContext state and dispatch
 * separately, call them here and export the state and dispatch in an array.
 */
export const useApp = () => {
  const state = useAppState()
  const dispatch = useAppDispatch()
  return [state, dispatch] as [State, Dispatch]
}
