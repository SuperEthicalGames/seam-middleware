import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ConsolidatedProfile } from '@/types/game'
import { GAME_CATALOG } from '@/config/games'
import type { SessionFilters } from '@/utils/sessionFilters'
import { applySessionFilters, hasActiveFilters } from '@/utils/sessionFilters'
import { formatDateEs, formatDifficultyLabel, formatDurationEs } from '@/utils/normalize'
import { formatExerciseLabel } from '@/utils/labels'

interface GenerateParams {
  profile: ConsolidatedProfile
  filters: SessionFilters
  generatedByEmail: string
}

const SEAM_TEAL: [number, number, number] = [22, 138, 128]

export function generatePatientReportPdf({ profile, filters, generatedByEmail }: GenerateParams): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 40
  let y = 50

  doc.setFillColor(...SEAM_TEAL)
  doc.rect(0, 0, 595, 8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.text('SEAM', marginX, y)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  doc.text('Reporte de actividad — Middleware', marginX, y + 16)

  y += 45
  doc.setDrawColor(225, 224, 217)
  doc.line(marginX, y, 555, y)
  y += 24

  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Cédula / CC: ${profile.identifier}`, marginX, y)
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 350, y)
  y += 16
  doc.text(`Generado por: ${generatedByEmail}`, marginX, y)
  y += 16

  if (hasActiveFilters(filters)) {
    const parts: string[] = []
    if (filters.dateFrom) parts.push(`desde ${formatDateEs(filters.dateFrom)}`)
    if (filters.dateTo) parts.push(`hasta ${formatDateEs(filters.dateTo)}`)
    if (filters.difficulty !== 'all') parts.push(`dificultad ${formatDifficultyLabel(filters.difficulty)}`)
    if (filters.exerciseQuery) parts.push(`ejercicio contiene "${filters.exerciseQuery}"`)
    doc.text(`Filtros aplicados: ${parts.join(', ')}`, marginX, y)
    y += 16
  } else {
    doc.text('Filtros aplicados: ninguno (todos los registros)', marginX, y)
    y += 16
  }

  y += 8

  // Resumen
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(20, 20, 20)
  doc.text('Resumen', marginX, y)
  y += 8

  const summaryRows = profile.results.map((r) => {
    const filtered = applySessionFilters(r.sessions, filters)
    const label = GAME_CATALOG[r.game].displayName
    if (r.state === 'NOT_FOUND') return [label, 'No encontrado', '-']
    if (r.state === 'ERROR') return [label, 'Error de consulta', '-']
    return [label, 'Encontrado', String(filtered.length)]
  })

  autoTable(doc, {
    startY: y + 6,
    margin: { left: marginX, right: marginX },
    head: [['Juego', 'Estado', 'Sesiones (con filtros)']],
    body: summaryRows,
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: SEAM_TEAL, textColor: 255 },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 24

  for (const r of profile.results) {
    if (r.state !== 'FOUND') continue
    const filtered = applySessionFilters(r.sessions, filters)
    if (filtered.length === 0) continue

    if (y > 700) {
      doc.addPage()
      y = 50
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(20, 20, 20)
    doc.text(GAME_CATALOG[r.game].displayName, marginX, y)
    y += 8

    autoTable(doc, {
      startY: y + 6,
      margin: { left: marginX, right: marginX },
      head: [['Fecha', 'Ejercicio', 'Dificultad', 'Puntaje', 'Estrellas', 'Duración']],
      body: filtered.map((s) => [
        formatDateEs(s.date),
        formatExerciseLabel(s.exercise),
        formatDifficultyLabel(s.difficulty),
        s.score === null ? 'No disponible' : String(s.score),
        s.stars === null ? 'No aplica' : '★'.repeat(s.stars),
        formatDurationEs(s.durationSeconds),
      ]),
      styles: { fontSize: 8.5, cellPadding: 5 },
      headStyles: { fillColor: [90, 90, 90], textColor: 255 },
      didDrawPage: () => {
        y = 50
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 24
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text('SEAM Middleware — Documento de uso interno. No compartir fuera de la organización.', marginX, 820)
    doc.text(`Página ${i} de ${pageCount}`, 500, 820)
  }

  doc.save(`SEAM_reporte_${profile.identifier}.pdf`)
}
