import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { GAME_CATALOG } from '@/config/games'
import type { GameId } from '@/types/game'
import { Modal } from './Modal'
import { useToast } from './ToastProvider'

type PasswordAction = { game: GameId; mode: 'connect' | 'create' }

/**
 * Aviso por cada juego que exige una sesión de administrador (hoy Cafetero) y no está conectado. Dice qué falta y permite resolverlo desde aquí:
 * conectar con la contraseña, o crear la cuenta del juego y pedir acceso (un propietario de ese juego lo aprueba en Administradores).
 */
export function GameLinksBanner() {
  const { games, connectGames, requestGameAccess, user } = useAuth()
  const { showToast } = useToast()
  const [action, setAction] = useState<PasswordAction | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const pending = (Object.entries(games) as [GameId, NonNullable<(typeof games)[GameId]>][]).filter(
    ([, state]) => state.status !== 'connected' && state.status !== 'checking',
  )
  if (pending.length === 0) return null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!action || !password) return
    setBusy(true)
    try {
      if (action.mode === 'connect') {
        await connectGames(password)
        showToast('success', 'Conexión actualizada. Recargue la página para ver los datos.')
      } else {
        const state = await requestGameAccess(action.game, password)
        showToast(state.status === 'error' || state.status === 'no-account' ? 'error' : 'success', state.status === 'pending' ? 'Solicitud enviada.' : state.message || 'Listo.')
      }
      setAction(null)
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  async function requestWithoutPassword(game: GameId) {
    setBusy(true)
    try {
      const state = await requestGameAccess(game)
      showToast(state.status === 'pending' ? 'success' : 'error', state.status === 'pending' ? 'Solicitud enviada. Un propietario debe aprobarla.' : state.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {pending.map(([game, state]) => (
        <div
          key={game}
          role="alert"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium">{GAME_CATALOG[game].displayName} no se puede consultar</p>
            <p className="mt-0.5">{state.message}</p>
            {state.uid && (state.status === 'not-admin' || state.status === 'pending') && <p className="mt-1 font-mono text-xs">UID: {state.uid}</p>}
          </div>
          {(state.status === 'no-session' || state.status === 'error') && (
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setAction({ game, mode: 'connect' })}>
              Conectar
            </button>
          )}
          {state.status === 'no-account' && (
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setAction({ game, mode: 'create' })}>
              Crear cuenta y solicitar acceso
            </button>
          )}
          {state.status === 'not-admin' && (
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => requestWithoutPassword(game)}>
              Solicitar acceso
            </button>
          )}
        </div>
      ))}

      <Modal
        open={action !== null}
        onClose={() => !busy && setAction(null)}
        title={action?.mode === 'create' ? `Crear cuenta en ${GAME_CATALOG[action.game].displayName}` : 'Conectar con su contraseña'}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setAction(null)} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" form="game-link-form" className="btn-primary" disabled={busy || !password}>
              {busy ? 'Un momento...' : action?.mode === 'create' ? 'Crear y solicitar' : 'Conectar'}
            </button>
          </>
        }
      >
        <form id="game-link-form" onSubmit={submit} className="space-y-3">
          <p>
            {action?.mode === 'create' ? (
              <>
                Se creará la cuenta de <span className="font-medium">{user?.email}</span> en {action ? GAME_CATALOG[action.game].displayName : ''} con la contraseña que escriba
                (use la misma del portal) y se enviará la solicitud de acceso. Un propietario del juego debe aprobarla.
              </>
            ) : (
              <>
                Escriba la contraseña de <span className="font-medium">{user?.email}</span>. Debe ser la misma de su cuenta en la base del juego.
              </>
            )}
          </p>
          <input
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoFocus
          />
        </form>
      </Modal>
    </>
  )
}
