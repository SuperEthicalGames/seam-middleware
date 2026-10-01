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
import { GAME_LINKS, adminGameLinks } from '@/firebase/gameLinks'
import { checkingState, noSessionState, type GameLinkState } from '@/firebase/gameLinkState'
import { clearMustChangePassword, ensureAdminProfile } from '@/services/AdminService'
import { updateGamePasswords } from '@/services/GameAdminService'
import type { AdminProfile } from '@/types/central'
import type { GameId } from '@/types/game'
import { toFriendlyMessage } from '@/utils/errors'

/** Estado del enlace con la base de cada juego cuyas Rules ya exigen una sesión de administrador */
export type GameLinkStates = Partial<Record<GameId, GameLinkState>>

interface AuthContextValue {
  user: User | null
  profile: AdminProfile | null
  loading: boolean
  /** Para cada juego que exige administradores (hoy Cafetero): sesión de administrador allí y figurar en `admins` */
  games: GameLinkStates
  /** Conecta con la contraseña del administrador los juegos que falten (por ejemplo si la sesión se abrió antes, o la contraseña cambió) */
  connectGames: (password: string) => Promise<void>
  /** Vuelve a comprobar el estado de cada juego (por ejemplo, tras esperar a que un propietario apruebe la solicitud) */
  refreshGames: () => Promise<void>
  /** Envía al correo el enlace para restablecer la contraseña de la cuenta en la base de un juego */
  resetGamePassword: (game: GameId) => Promise<boolean>
  /** Pide acceso de administrador en un juego (crea la cuenta del juego si hace falta). Un propietario de ese juego debe aprobarlo */
  requestGameAccess: (game: GameId, password?: string) => Promise<GameLinkState>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  /** Devuelve los juegos donde no se pudo actualizar la contraseña (la del portal sí quedó cambiada) */
  changePassword: (newPassword: string) => Promise<{ gamesNotUpdated: string[] }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const links = adminGameLinks()

function statesOf(make: (name: string) => GameLinkState): GameLinkStates {
  const states: GameLinkStates = {}
  for (const link of links) states[link.gameId] = make(link.displayName)
  return states
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [games, setGames] = useState<GameLinkStates>(() => statesOf(checkingState))

  function setGame(game: GameId, state: GameLinkState) {
    setGames((prev) => ({ ...prev, [game]: state }))
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(centralAuth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        // Una sesión que se restaura al recargar la página ya trae guardadas sus sesiones de los juegos: solo se comprueban
        for (const link of links) {
          link.check().then(
            (state) => setGame(link.gameId, state),
            () => setGame(link.gameId, noSessionState(link.displayName)),
          )
        }
        try {
          const p = await ensureAdminProfile(firebaseUser)
          setProfile(p)
        } catch {
          setProfile(null)
        }
      } else {
        setProfile(null)
        setGames(statesOf(noSessionState))
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    async function connectAll(email: string, password: string) {
      setGames(statesOf(checkingState))
      await Promise.all(links.map(async (link) => setGame(link.gameId, await link.connect(email, password))))
    }

    return {
      user,
      profile,
      loading,
      games,
      async connectGames(password) {
        const email = centralAuth.currentUser?.email
        if (!email) return
        await connectAll(email, password)
      },
      async refreshGames() {
        await Promise.all(
          links.map(async (link) => {
            try {
              setGame(link.gameId, await link.check())
            } catch {
              setGame(link.gameId, noSessionState(link.displayName))
            }
          }),
        )
      },
      async resetGamePassword(game) {
        const email = centralAuth.currentUser?.email
        return email ? GAME_LINKS[game].resetPassword(email) : false
      },
      async requestGameAccess(game, password) {
        const link = GAME_LINKS[game]
        const email = centralAuth.currentUser?.email
        setGame(game, checkingState(link.displayName))
        const state = await link.requestAccess(email && password ? { email, password } : undefined)
        setGame(game, state)
        return state
      },
      async signIn(email, password) {
        try {
          await signInWithEmailAndPassword(centralAuth, email, password)
        } catch (error) {
          throw new Error(toFriendlyMessage(error))
        }
        // Los juegos que exigen administradores piden una sesión real en su propia base: se entra con las mismas credenciales.
        // Si esa cuenta no existe allí el portal sigue funcionando; solo ese juego mostrará el aviso correspondiente.
        await connectAll(email, password)
      },
      async signOut() {
        await Promise.all(links.map((link) => link.signOut().catch(() => {})))
        setGames(statesOf(noSessionState))
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
        // La misma contraseña en la base de cada juego, para que la próxima conexión funcione sin pedirla aparte
        const gamesNotUpdated = await updateGamePasswords(newPassword).catch(() => links.map((l) => l.displayName))
        return { gamesNotUpdated }
      },
    }
  }, [user, profile, loading, games])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
