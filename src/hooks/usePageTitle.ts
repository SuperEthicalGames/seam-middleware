import { useEffect } from 'react'

/** Actualiza el título de la pestaña del navegador para cada página del portal. */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = `${title} — SEAM Middleware`
    return () => {
      document.title = previous
    }
  }, [title])
}
