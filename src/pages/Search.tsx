import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { findConsolidatedProfile } from '@/services/ConsolidationService'
import type { ConsolidatedProfile } from '@/types/game'
import { GAME_CATALOG } from '@/config/games'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { InlineSpinner } from '@/components/LoadingSpinner'
import { toFriendlyMessage } from '@/utils/errors'

export function Search() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [result, setResult] = useState<ConsolidatedProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = identifier.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const profile = await findConsolidatedProfile(trimmed)
      setResult(profile)
    } catch (err) {
      setError(toFriendlyMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setIdentifier('')
    setResult(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-ink-800">Buscar por cédula / CC</h2>
        <p className="mb-4 text-sm text-ink-500">
          La búsqueda consulta los tres juegos de forma independiente. Un paciente puede existir en unos juegos y no en otros.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input sm:max-w-xs"
            placeholder="Ej. 1005180573"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            inputMode="numeric"
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={loading || !identifier.trim()}>
              Buscar
            </button>
            <button type="button" className="btn-secondary" onClick={handleClear} disabled={loading}>
              Limpiar filtros
            </button>
          </div>
        </form>
      </Card>

      {loading && <InlineSpinner label="Consultando los tres juegos..." />}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-800">Resultado para {result.identifier}</h3>
            <button className="btn-primary" onClick={() => navigate(`/paciente/${encodeURIComponent(result.identifier)}`)}>
              Ver perfil consolidado
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {result.results.map((r) => (
              <div key={r.game} className="rounded-lg border border-ink-100 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-800">{GAME_CATALOG[r.game].displayName}</span>
                  {r.state === 'FOUND' && <Badge tone="success">Encontrado</Badge>}
                  {r.state === 'NOT_FOUND' && <Badge tone="neutral">No encontrado</Badge>}
                  {r.state === 'ERROR' && <Badge tone="danger">Error</Badge>}
                </div>
                {r.state === 'FOUND' && <p className="mt-2 text-sm text-ink-500">{r.sessions.length} sesiones registradas</p>}
                {r.state === 'ERROR' && <p className="mt-2 text-sm text-red-600">{r.errorMessage}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
