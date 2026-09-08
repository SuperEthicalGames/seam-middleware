import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { ToastProvider } from '@/components/ToastProvider'
import { AppLayout } from '@/layouts/AppLayout'
import { Login } from '@/pages/Login'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { Dashboard } from '@/pages/Dashboard'
import { Search } from '@/pages/Search'
import { PatientProfile } from '@/pages/PatientProfile'
import { GamesList } from '@/pages/GamesList'
import { GameDetail } from '@/pages/GameDetail'
import { Serials } from '@/pages/Serials'
import { Admins } from '@/pages/Admins'
import { AuditLog } from '@/pages/AuditLog'
import { Profile } from '@/pages/Profile'
import { NotFound } from '@/pages/NotFound'

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
