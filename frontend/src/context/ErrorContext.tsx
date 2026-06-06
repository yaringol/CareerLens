import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiError } from '../services/api'

export interface AppErrorState {
  message: string
  code: string
  status: number
}

interface ErrorContextValue {
  error: AppErrorState | null
  setError: (error: AppErrorState | ApiError | string | null) => void
  clearError: () => void
  reportError: (err: unknown) => void
}

const ErrorContext = createContext<ErrorContextValue | null>(null)

function toAppError(error: AppErrorState | ApiError | string): AppErrorState {
  if (typeof error === 'string') {
    return { message: error, code: 'CLIENT', status: 0 }
  }
  if (error instanceof ApiError) {
    return { message: error.message, code: error.code, status: error.status }
  }
  return error
}

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setErrorState] = useState<AppErrorState | null>(null)

  const clearError = useCallback(() => setErrorState(null), [])

  const setError = useCallback((next: AppErrorState | ApiError | string | null) => {
    if (next === null) {
      setErrorState(null)
      return
    }
    setErrorState(toAppError(next))
  }, [])

  const reportError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        return
      }
      if (err instanceof Error && err.message) {
        setError(err.message)
        return
      }
      setError('Something went wrong. Please try again.')
    },
    [setError]
  )

  const value = useMemo(
    () => ({ error, setError, clearError, reportError }),
    [error, setError, clearError, reportError]
  )

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>
}

export function useError(): ErrorContextValue {
  const ctx = useContext(ErrorContext)
  if (!ctx) {
    throw new Error('useError must be used within ErrorProvider')
  }
  return ctx
}
