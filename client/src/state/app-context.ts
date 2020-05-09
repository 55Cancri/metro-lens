import React from 'react'

type Action = { type: 'loading' } | { type: 'login' }
type Dispatch = (action: Action) => void
type State = {
  isLoading: boolean
  token: string
}

const AppStateContext = React.createContext()
const AppDispatcheContext = React.createContext()

const appReducer = (state, action) => {
  switch (action.type) {
    case 'loading': {
      return {}
    }

    case 'login': {
      return { ...state, token: action }
    }
  }
}
