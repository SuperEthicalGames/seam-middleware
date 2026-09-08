import { lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
const Admins = lazy(() => import('@/pages/Admins').then((m) => ({ default: m.Admins })))
const AuditLog = lazy(() => import('@/pages/AuditLog').then((m) => ({ default: m.AuditLog })))
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })))

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar" element={<ForgotPassword />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/buscar" element={<Search />} />
                <Route path="/paciente/:identifier" element={<PatientProfile />} />
                <Route path="/juegos" element={<GamesList />} />
                <Route path="/juegos/:gameId" element={<GameDetail />} />
                <Route path="/seriales" element={<Serials />} />
                <Route path="/administradores" element={<Admins />} />
                <Route path="/auditoria" element={<AuditLog />} />
                <Route path="/perfil" element={<Profile />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
