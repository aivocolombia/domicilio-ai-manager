import { useState, useCallback } from 'react'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface UseAsyncStateReturn<T> {
  data: T | null
  loading: boolean
  error: string | null
  setData: (data: T | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
  execute: <Args extends any[]>(
    asyncFunction: (...args: Args) => Promise<T>,
    ...args: Args
  ) => Promise<T | null>
}

export function useAsyncState<T = any>(initialData: T | null = null): UseAsyncStateReturn<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    loading: false,
    error: null
  })

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data, error: null }))
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error, loading: false }))
  }, [])

  const reset = useCallback(() => {
    setState({
      data: initialData,
      loading: false,
      error: null
    })
  }, [initialData])

  const execute = useCallback(async <Args extends any[]>(
    asyncFunction: (...args: Args) => Promise<T>,
    ...args: Args
  ): Promise<T | null> => {
    try {
      setLoading(true)
      setError(null)
      const result = await asyncFunction(...args)
      setData(result)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [setData, setError, setLoading])

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    setData,
    setLoading,
    setError,
    reset,
    execute
  }
}