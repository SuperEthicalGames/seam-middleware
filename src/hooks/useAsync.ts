import { useCallback, useEffect, useRef, useState } from 'react'
import { toFriendlyMessage } from '@/utils/errors'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Ejecuta `fn` cuando cambian las `deps` y expone {data, loading, error, reload}.
 * Ignora resultados de ejecuciones obsoletas (evita condiciones de carrera al cambiar
 * de filtro rápidamente).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null })
  const requestId = useRef(0)

  const run = useCallback(() => {
    const id = ++requestId.current
    setState((s) => ({ ...s, loading: true, error: null }))
    fn()
      .then((data) => {
        if (requestId.current === id) setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (requestId.current === id) setState({ data: null, loading: false, error: toFriendlyMessage(error) })
      })
    // `deps` es intencionalmente dinámico: este hook expone la misma API que useEffect
    // para dependencias arbitrarias definidas por cada caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    run()
  }, [run])

  return { ...state, reload: run }
}
