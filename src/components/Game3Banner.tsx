import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { Modal } from './Modal'
import { useToast } from './ToastProvider'

/**
 * Aviso cuando el portal no está conectado a la base de Cafetero (seam-data-game). Sus Rules solo dejan leer a los administradores de
 * esa base, así que mientras falte la conexión los datos de Cafetero no cargan. Dice qué falta y deja reconectar con la contraseña.
 */
export function Game3Banner() {
  const { game3, connectGame3, user } = useAuth()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  if (game3.status === 'connected' || game3.status === 'checking') return null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!password) return
    setBusy(true)
    try {
      const link = await connectGame3(password)
      if (link.status === 'connected') {
        showToast('success', 'Cafetero conectado. Recargue la página para ver sus datos.')
        setOpen(false)
        setPassword('')
      } else {
        showToast('error', link.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Cafetero no se puede consultar</p>
          <p className="mt-0.5">{game3.message}</p>
          {game3.uid && game3.status === 'not-admin' && <p className="mt-1 font-mono text-xs">UID: {game3.uid}</p>}
        </div>
        {game3.status !== 'not-admin' && (
          <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
            Conectar Cafetero
          </button>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Conectar Cafetero"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" form="game3-connect-form" className="btn-primary" disabled={busy || !password}>
              {busy ? 'Conectando...' : 'Conectar'}
            </button>
          </>
        }
      >
        <form id="game3-connect-form" onSubmit={submit} className="space-y-3">
          <p>
            Escriba la contraseña de <span className="font-medium">{user?.email}</span>. Debe ser la misma de la cuenta de administrador creada en la
            base de Cafetero.
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
