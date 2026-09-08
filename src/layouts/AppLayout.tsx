import { Suspense, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar, SidebarNav } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { Logo } from '@/components/Logo'
import { InlineSpinner } from '@/components/LoadingSpinner'

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard'
  if (pathname.startsWith('/buscar')) return 'Buscar paciente'
  if (pathname.startsWith('/paciente/')) return 'Perfil consolidado'
  if (pathname.startsWith('/juegos/')) return 'Detalle de juego'
  if (pathname.startsWith('/juegos')) return 'Juegos'
  if (pathname.startsWith('/seriales')) return 'Seriales'
  if (pathname.startsWith('/administradores')) return 'Administradores'
  if (pathname.startsWith('/auditoria')) return 'Auditoría'
  if (pathname.startsWith('/perfil')) return 'Mi perfil'
  return 'SEAM Middleware'
}

export function AppLayout() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-ink-50">
      <Sidebar />

      {mobileOpen && (
        <div className="fixed inset-0 z-30 flex md:hidden">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setMobileOpen(false)} />
          <div className="relative flex w-64 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center border-b border-ink-100 px-5">
              <Logo />
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={getPageTitle(location.pathname)} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Suspense fallback={<InlineSpinner label="Cargando página..." />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
