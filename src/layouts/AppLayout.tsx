import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { Sidebar, SidebarNav } from '@/components/Sidebar'
import { Header, type HeaderParent } from '@/components/Header'
import { Logo } from '@/components/Logo'
import { InlineSpinner } from '@/components/LoadingSpinner'
import { GAME_CATALOG } from '@/config/games'
import type { GameId } from '@/types/game'

interface PageMeta {
  title: string
  /** Para páginas de detalle que no tienen su propio ítem en el sidebar — un link
   * de "volver" a la sección de la que conceptualmente cuelgan. */
  parent?: HeaderParent
}

function isGameId(value: string | undefined): value is GameId {
  return value === 'game1' || value === 'game2' || value === 'game3'
}

function getPageMeta(pathname: string, gameId: string | undefined): PageMeta {
  if (pathname === '/') return { title: 'Dashboard' }
  if (pathname.startsWith('/buscar')) return { title: 'Buscar paciente' }
  if (pathname.startsWith('/paciente/')) return { title: 'Perfil consolidado', parent: { label: 'Buscar paciente', to: '/buscar' } }
  if (pathname.startsWith('/juegos/')) {
    const title = isGameId(gameId) ? GAME_CATALOG[gameId].displayName : 'Detalle de juego'
    return { title, parent: { label: 'Juegos', to: '/juegos' } }
  }
  if (pathname.startsWith('/juegos')) return { title: 'Juegos' }
  if (pathname.startsWith('/seriales')) return { title: 'Seriales' }
  if (pathname.startsWith('/administradores')) return { title: 'Administradores' }
  if (pathname.startsWith('/auditoria')) return { title: 'Auditoría' }
  if (pathname.startsWith('/perfil')) return { title: 'Mi perfil' }
  return { title: 'SEAM Middleware' }
}

export function AppLayout() {
  const location = useLocation()
  const { gameId } = useParams<{ gameId?: string }>()
  const [mobileOpen, setMobileOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const pageMeta = getPageMeta(location.pathname, gameId)

  useEffect(() => {
    document.title = `${pageMeta.title} — SEAM Middleware`
  }, [pageMeta.title])

  useEffect(() => {
    setMobileOpen(false)
    mainRef.current?.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="flex h-screen bg-ink-50">
      <Sidebar />

      {mobileOpen && (
        <div className="fixed inset-0 z-30 flex animate-fade-in md:hidden">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setMobileOpen(false)} />
          <div className="relative flex w-64 animate-slide-in-left flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center border-b border-ink-100 px-5">
              <Logo />
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={pageMeta.title} parent={pageMeta.parent} onMenuClick={() => setMobileOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 md:p-6">
          <Suspense fallback={<InlineSpinner label="Cargando página..." />}>
            <div key={location.pathname} className="animate-fade-in-up">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
