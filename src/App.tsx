import { lazy } from 'react'
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { ToastProvider } from '@/components/ToastProvider'
import { AppLayout } from '@/layouts/AppLayout'
import { Login } from '@/pages/Login'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { NotFound } from '@/pages/NotFound'

// Code-splitting por ruta: el login no debe descargar recharts/jsPDF, que solo
// usan las páginas internas. Cada import() se convierte en su propio chunk (Vite).
// El Suspense que las envuelve vive en AppLayout (alrededor del <Outlet/>), no aquí,
// para que el sidebar y el header no desaparezcan en cada cambio de página.
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Search = lazy(() => import('@/pages/Search').then((m) => ({ default: m.Search })))
const PatientProfile = lazy(() => import('@/pages/PatientProfile').then((m) => ({ default: m.PatientProfile })))
const GamesList = lazy(() => import('@/pages/GamesList').then((m) => ({ default: m.GamesList })))
const GameDetail = lazy(() => import('@/pages/GameDetail').then((m) => ({ default: m.GameDetail })))
const Serials = lazy(() => import('@/pages/Serials').then((m) => ({ default: m.Serials })))
const Exportar = lazy(() => import('@/pages/Exportar').then((m) => ({ default: m.Exportar })))
const AgendaSesion = lazy(() => import('@/pages/AgendaSesion').then((m) => ({ default: m.AgendaSesion })))
const Admins = lazy(() => import('@/pages/Admins').then((m) => ({ default: m.Admins })))
const AuditLog = lazy(() => import('@/pages/AuditLog').then((m) => ({ default: m.AuditLog })))
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })))

/** Enlaces guardados o compartidos antes de renombrar la ruta (`#/paciente/:id`): siguen abriendo el perfil. */
function LegacyUserRedirect() {
  const { identifier = '' } = useParams<{ identifier: string }>()
  return <Navigate to={`/usuario/${encodeURIComponent(identifier)}`} replace />
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        {/* HashRouter (URLs con #) en vez de BrowserRouter: publicado en GitHub Pages,
            que no puede reescribir rutas al servidor — con BrowserRouter, recargar o
            compartir un link directo a /usuario/123 daría 404. */}
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar" element={<ForgotPassword />} />
            <Route path="/paciente/:identifier" element={<LegacyUserRedirect />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/buscar" element={<Search />} />
                <Route path="/usuario/:identifier" element={<PatientProfile />} />
                <Route path="/juegos" element={<GamesList />} />
                <Route path="/juegos/:gameId" element={<GameDetail />} />
                <Route path="/seriales" element={<Serials />} />
                <Route path="/agenda" element={<AgendaSesion />} />
                <Route path="/exportar" element={<Exportar />} />
                <Route path="/administradores" element={<Admins />} />
                <Route path="/auditoria" element={<AuditLog />} />
                <Route path="/perfil" element={<Profile />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
