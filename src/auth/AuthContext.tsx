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
import { checkGame3Link, connectGame3Admin, signOutGame3 } from '@/firebase/game3'
import { GAME3_CHECKING, GAME3_NO_SESSION, type Game3Link } from '@/firebase/game3Link'
import { clearMustChangePassword, ensureAdminProfile } from '@/services/AdminService'
import type { AdminProfile } from '@/types/central'
import { toFriendlyMessage } from '@/utils/errors'

interface AuthContextValue {
  user: User | null
  profile: AdminProfile | null
  loading: boolean
  /** Enlace del portal con la base de Cafetero: sesión de administrador allí y figurar en `admins` */
  game3: Game3Link
  /** Conecta Cafetero con la contraseña del administrador (por ejemplo si la sesión se abrió antes de existir este enlace) */
  connectGame3: (password: string) => Promise<Game3Link>
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
  const [game3, setGame3] = useState<Game3Link>(GAME3_CHECKING)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(centralAuth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        // Una sesión que se restaura al recargar la página ya trae su sesión de Cafetero guardada por Firebase: solo se comprueba
        checkGame3Link().then(setGame3, () => setGame3(GAME3_NO_SESSION))
        try {
          const p = await ensureAdminProfile(firebaseUser)
          setProfile(p)
        } catch {
          setProfile(null)
        }
      } else {
        setProfile(null)
        setGame3(GAME3_NO_SESSION)
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
      game3,
      async connectGame3(password) {
        const email = centralAuth.currentUser?.email
        if (!email) return GAME3_NO_SESSION
        setGame3(GAME3_CHECKING)
        const link = await connectGame3Admin(email, password)
        setGame3(link)
        return link
      },
      async signIn(email, password) {
        try {
          await signInWithEmailAndPassword(centralAuth, email, password)
        } catch (error) {
          throw new Error(toFriendlyMessage(error))
        }
        // El Juego 3 exige un administrador real en su propia base (no hay sesión anónima): se entra con las mismas credenciales.
        // Si esa cuenta no existe allí el portal sigue funcionando; solo el Juego 3 mostrará el aviso correspondiente.
        setGame3(GAME3_CHECKING)
        setGame3(await connectGame3Admin(email, password))
      },
      async signOut() {
        await signOutGame3().catch(() => {})
        setGame3(GAME3_NO_SESSION)
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
    [user, profile, loading, game3],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
