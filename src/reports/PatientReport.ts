import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ConsolidatedProfile, GameId, NormalizedSession } from '@/types/game'
import { GAME_CATALOG } from '@/config/games'
import { GAME_COLORS } from '@/charts/palette'
import type { SessionFilters } from '@/utils/sessionFilters'
import { applySessionFilters, hasActiveFilters } from '@/utils/sessionFilters'
import { formatDateEs, formatDifficultyLabel, formatDurationEs } from '@/utils/normalize'
import { formatExerciseLabel } from '@/utils/labels'
import { estimateCafeteroStars } from '@/utils/estimatedStars'
import { computeSessionStats } from '@/utils/patientStats'
import { computeExercisePerformance, type PerformanceTrend } from '@/utils/exercisePerformance'
import { computePatientConclusions, formatConclusionsText } from '@/utils/patientConclusions'
import { drawHorizontalBarChart, drawLineChart, drawRatingCircles } from './pdfCharts'

interface GenerateParams {
  profile: ConsolidatedProfile
  filters: SessionFilters
  generatedByEmail: string
}

const SEAM_TEAL: [number, number, number] = [22, 138, 128]
const STARS_COLUMN_INDEX = 4
const REAL_STAR_COLOR: [number, number, number] = [40, 40, 40]
const ESTIMATED_STAR_COLOR: [number, number, number] = [217, 149, 20] // ámbar, igual criterio que la UI

// jsPDF con las fuentes estándar (helvetica) solo soporta WinAnsiEncoding — los
// caracteres ★ ↑ → ↓ quedan fuera de esa codificación y el PDF los renderiza como
// glifos rotos con espaciado incorrecto (verificado renderizando el PDF real, no
// solo la consola). Las estrellas se dibujan como círculos vectoriales (nunca fallan
// por codificación); la tendencia usa texto plano en vez de flechas Unicode.
const TREND_LABEL: Record<PerformanceTrend, string> = {
  mejorando: '+ Mejorando',
  estable: '= Estable',
  disminuyendo: '- Disminuyendo',
}

interface StarInfo {
  filled: number
  estimated: boolean
}

function getStarInfo(s: NormalizedSession): StarInfo | null {
  if (s.stars !== null) return { filled: s.stars, estimated: false }
  const estimated = s.game === 'game3' ? estimateCafeteroStars(s.score, s.exercise) : null
  return estimated === null ? null : { filled: estimated, estimated: true }
}

function chronologicalScores(sessions: NormalizedSession[]): number[] {
  return sessions
    .filter((s) => s.score !== null)
    .slice()
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.hour ?? '').localeCompare(b.hour ?? ''))
    .map((s) => s.score as number)
}

export function generatePatientReportPdf({ profile, filters, generatedByEmail }: GenerateParams): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 40
  const contentWidth = 555 - marginX
  let y = 50

  function ensureSpace(needed: number) {
    if (y + needed > 780) {
      doc.addPage()
      y = 50
    }
  }

  function subheading(text: string) {
    ensureSpace(26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(20, 20, 20)
    doc.text(text, marginX, y)
    y += 4
  }

  doc.setFillColor(...SEAM_TEAL)
  doc.rect(0, 0, 595, 8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.text('SEAM', marginX, y)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  doc.text('Reporte de actividad y rendimiento — Middleware', marginX, y + 16)

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

  // Resumen general
  subheading('Resumen')

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

  // Conclusiones — síntesis estadística de los datos ya calculados, nunca una
  // interpretación clínica (sección 21 del prompt original: prohibido diagnosticar).
  const conclusions = computePatientConclusions(profile, filters)
  const conclusionLines = formatConclusionsText(conclusions)
  if (conclusionLines.length > 0) {
    subheading('Conclusiones')
    y += 10 // subheading() solo deja 4pt — suficiente antes de un autoTable (que añade su propio padding), no antes de texto plano como estas líneas
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(60, 60, 60)
    for (const line of conclusionLines) {
      ensureSpace(16)
      doc.text(`•  ${line}`, marginX, y, { maxWidth: contentWidth })
      y += 15
    }
    y += 2
    ensureSpace(14)
    doc.setFontSize(7.5)
    doc.setTextColor(140, 140, 140)
    doc.text('Síntesis estadística de las sesiones registradas — no constituye una evaluación clínica ni un diagnóstico.', marginX, y)
    y += 22
  }

  for (const r of profile.results) {
    if (r.state !== 'FOUND') continue
    const filtered = applySessionFilters(r.sessions, filters)
    if (filtered.length === 0) continue

    const gameColor = hexToRgb(GAME_COLORS[r.game as GameId])

    ensureSpace(40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(20, 20, 20)
    doc.text(GAME_CATALOG[r.game].displayName, marginX, y)
    y += 18

    // Estadísticas generales del juego (mismas que en el portal)
    const stats = computeSessionStats(filtered)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(70, 70, 70)
    doc.text(
      `Sesiones: ${stats.count}   ·   Puntaje promedio: ${stats.avgScore ?? 'No disponible'}   ·   Mejor puntaje: ${stats.bestScore ?? 'No disponible'}   ·   Duración promedio: ${formatDurationEs(stats.avgDurationSeconds)}`,
      marginX,
      y,
    )
    y += 18

    // Gráfico: progreso de puntaje en el tiempo (mismo dato que ScoreTrendChart en la UI)
    const scores = chronologicalScores(filtered)
    subheading('Progreso de puntaje')
    ensureSpace(90)
    y = drawLineChart(doc, { x: marginX + 20, y, width: contentWidth - 20, height: 70, values: scores, color: gameColor })

    // Capacidad fisioterapéutica por ejercicio/minijuego — el análisis central del portal
    const exerciseRows = computeExercisePerformance(filtered, r.game)
    if (exerciseRows.length > 0) {
      subheading('Capacidad fisioterapéutica por ejercicio')

      autoTable(doc, {
        startY: y + 6,
        margin: { left: marginX, right: marginX },
        head: [['Ejercicio', 'Sesiones', 'Puntaje prom.', 'Rendimiento', 'Mejor puntaje', 'Duración prom.', 'Tendencia']],
        body: exerciseRows.map((ex) => [
          formatExerciseLabel(ex.exercise),
          String(ex.count),
          ex.avgScore === null ? 'No disponible' : String(ex.avgScore),
          ex.avgScorePercent === null ? 'No disponible' : `${ex.avgScorePercent}%`,
          ex.bestScore === null ? 'No disponible' : String(ex.bestScore),
          formatDurationEs(ex.avgDurationSeconds),
          ex.trend === null ? 'Insuficiente' : TREND_LABEL[ex.trend],
        ]),
        styles: { fontSize: 8.5, cellPadding: 5 },
        headStyles: { fillColor: [90, 90, 90], textColor: 255 },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 20

      // Gráfico: rendimiento (%) por ejercicio — normalizado, sí comparable entre
      // ejercicios de un mismo paciente (ver scoreReference.ts).
      const barData = exerciseRows
        .filter((ex) => ex.avgScorePercent !== null)
        .map((ex) => ({ label: formatExerciseLabel(ex.exercise), value: ex.avgScorePercent as number, displayValue: `${ex.avgScorePercent}%` }))
      if (barData.length > 0) {
        subheading('Rendimiento por ejercicio (% de una partida de referencia)')
        ensureSpace(barData.length * 16 + 20)
        y = drawHorizontalBarChart(doc, { x: marginX, y, width: contentWidth, labelWidth: 150, data: barData, max: 100, color: gameColor })
        y += 10
      }
    }

    // Detalle de sesiones (dato crudo, para trazabilidad completa)
    ensureSpace(30)
    subheading('Detalle de sesiones')

    const starInfos = filtered.map(getStarInfo)

    autoTable(doc, {
      startY: y + 6,
      margin: { left: marginX, right: marginX },
      head: [['Fecha', 'Ejercicio', 'Dificultad', 'Puntaje', 'Estrellas', 'Duración']],
      body: filtered.map((s, i) => {
        const info = starInfos[i]
        return [
          formatDateEs(s.date),
          formatExerciseLabel(s.exercise),
          formatDifficultyLabel(s.difficulty),
          s.score === null ? 'No disponible' : String(s.score),
          info === null ? 'No aplica' : '', // se dibuja con círculos en didDrawCell
          formatDurationEs(s.durationSeconds),
        ]
      }),
      styles: { fontSize: 8.5, cellPadding: 5, minCellHeight: 16 },
      headStyles: { fillColor: [90, 90, 90], textColor: 255 },
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index !== STARS_COLUMN_INDEX) return
        const info = starInfos[data.row.index]
        if (!info) return
        const cy = data.cell.y + data.cell.height / 2
        drawRatingCircles(doc, data.cell.x + 4, cy, info.filled, 3, info.estimated ? ESTIMATED_STAR_COLOR : REAL_STAR_COLOR)
        if (info.estimated) {
          doc.setFontSize(6.5)
          doc.setTextColor(...ESTIMATED_STAR_COLOR)
          doc.text('estimado', data.cell.x + 4 + 3 * 7.5 + 3, cy + 2)
        }
      },
      didDrawPage: () => {
        y = 50
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 28
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

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const num = parseInt(clean, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}
