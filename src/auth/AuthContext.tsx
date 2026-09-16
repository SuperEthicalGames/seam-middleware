import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updatePassword,
  type User,
} from 'firebase/auth'
import { centralAuth } from '@/firebase/central'
import { clearMustChangePassword, ensureAdminProfile } from '@/services/AdminService'
import type { AdminProfile } from '@/types/central'
import { toFriendlyMessage } from '@/utils/errors'

interface AuthContextValue {
  user: User | null
  profile: AdminProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  changePassword: (newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(centralAuth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        try {
          const p = await ensureAdminProfile(firebaseUser)
          setProfile(p)
        } catch {
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      async signIn(email, password) {
        try {
          await signInWithEmailAndPassword(centralAuth, email, password)
        } catch (error) {
          throw new Error(toFriendlyMessage(error))
        }
      },
      async signOut() {
        await firebaseSignOut(centralAuth)
      },
      async resetPassword(email) {
        try {
          await sendPasswordResetEmail(centralAuth, email)
        } catch (error) {
          throw new Error(toFriendlyMessage(error))
        }
      },
      async changePassword(newPassword) {
        if (!centralAuth.currentUser) throw new Error('No hay una sesión activa.')
        try {
          await updatePassword(centralAuth.currentUser, newPassword)
        } catch (error) {
          throw new Error(toFriendlyMessage(error))
        }
        if (profile?.mustChangePassword) {
          // La contraseña de Auth ya cambió (lo que importa para la seguridad de la cuenta);
          // si esta escritura falla no se revierte lo anterior, solo se le volverá a pedir
          // el cambio en el próximo login.
          setProfile({ ...profile, mustChangePassword: false })
          await clearMustChangePassword(profile.uid).catch(() => {})
        }
      },
    }),
    [user, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
