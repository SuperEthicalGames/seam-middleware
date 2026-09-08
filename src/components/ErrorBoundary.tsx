import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Última línea de defensa: si un error de render escapa de todo lo demás, esto
 * evita una pantalla en blanco y muestra un mensaje seguro (sección 29 del prompt —
 * nunca exponer errores técnicos crudos al usuario final).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SEAM Middleware — error no controlado:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 9v4M12 17h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.1l-8-14a2 2 0 00-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-ink-900">Ocurrió un error inesperado</p>
            <p className="mt-1 max-w-sm text-sm text-ink-500">
              El portal encontró un problema al mostrar esta página. Intente recargar; si el problema continúa, contacte a soporte técnico.
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={() => window.location.assign('/')}>
            Volver al inicio
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
