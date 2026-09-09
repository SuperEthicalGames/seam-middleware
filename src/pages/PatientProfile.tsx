import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAsync } from '@/hooks/useAsync'
import { findConsolidatedProfile } from '@/services/ConsolidationService'
import { GAME_CATALOG } from '@/config/games'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { ErrorState, TableSkeleton, EmptyState } from '@/components/States'
import { FilterBar } from '@/components/FilterBar'
import { SessionsTable } from '@/components/SessionsTable'
import { PatientPerformanceSummary } from '@/components/PatientPerformanceSummary'
import { PatientConclusions } from '@/components/PatientConclusions'
import { EMPTY_FILTERS, applySessionFilters } from '@/utils/sessionFilters'
import { generatePatientReportPdf } from '@/reports/PatientReport'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/ToastProvider'

export function PatientProfile() {
  const { identifier = '' } = useParams<{ identifier: string }>()
  const { profile: adminProfile } = useAuth()
  const { showToast } = useToast()
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  const { data, loading, error, reload } = useAsync(() => findConsolidatedProfile(identifier), [identifier])

  // Cada resultado se filtra una sola vez aquí y se reutiliza abajo (conteo total,
  // resumen de rendimiento y tabla de sesiones) — antes se llamaba a
  // applySessionFilters por separado en cada uno de esos 3 lugares por juego.
  const filteredResults = useMemo(() => {
    if (!data) return []
    return data.results.map((r) => ({ ...r, filteredSessions: applySessionFilters(r.sessions, filters) }))
  }, [data, filters])

  const totalFilteredSessions = useMemo(() => filteredResults.reduce((acc, r) => acc + r.filteredSessions.length, 0), [filteredResults])

  function handleExport() {
    if (!data) return
    try {
      generatePatientReportPdf({ profile: data, filters, generatedByEmail: adminProfile?.email ?? 'desconocido' })
      showToast('success', 'Reporte PDF generado.')
    } catch {
      showToast('error', 'No fue posible generar el PDF. Intente de nuevo.')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <TableSkeleton rows={3} cols={1} />
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return <ErrorState message={error ?? 'No fue posible cargar el perfil.'} onRetry={reload} />
  }

  const foundCount = data.results.filter((r) => r.state === 'FOUND').length

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-400">Cédula / CC</p>
          <h2 className="text-xl font-semibold text-ink-900">{data.identifier}</h2>
          <p className="mt-1 text-sm text-ink-500">
            Encontrado en {foundCount} de {data.results.length} juegos
          </p>
        </div>
        <button className="btn-primary" onClick={handleExport} disabled={foundCount === 0}>
          Exportar PDF
        </button>
      </Card>

      <FilterBar value={filters} onChange={setFilters} />

      <p className="text-sm text-ink-500">{totalFilteredSessions} sesiones coinciden con los filtros actuales.</p>

      <PatientConclusions profile={data} filters={filters} />

      {filteredResults.map((r) => (
        <Card key={r.game}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-800">{GAME_CATALOG[r.game].displayName}</h3>
            {r.state === 'FOUND' && <Badge tone="success">Encontrado</Badge>}
            {r.state === 'NOT_FOUND' && <Badge tone="neutral">No encontrado</Badge>}
            {r.state === 'ERROR' && <Badge tone="danger">Error</Badge>}
          </div>

          {r.state === 'NOT_FOUND' && <EmptyState title="No se encontró este paciente en este juego." />}
          {r.state === 'ERROR' && <ErrorState message={r.errorMessage ?? `No fue posible consultar ${GAME_CATALOG[r.game].displayName}.`} onRetry={reload} />}
          {r.state === 'FOUND' && (
            <>
              <PatientPerformanceSummary sessions={r.filteredSessions} game={r.game} />
              <SessionsTable sessions={r.filteredSessions} />
            </>
          )}
        </Card>
      ))}
    </div>
  )
}
