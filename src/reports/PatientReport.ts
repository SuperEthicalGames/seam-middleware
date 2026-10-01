import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ConsolidatedProfile, GameId, NormalizedSession } from '@/types/game'
import { GAME_CATALOG } from '@/config/games'
import { GAME_COLORS } from '@/charts/palette'
import type { SessionFilters } from '@/utils/sessionFilters'
import { applySessionFilters, hasActiveFilters } from '@/utils/sessionFilters'
import { formatDateEs, formatDifficultyLabel, formatDurationEs } from '@/utils/normalize'
import { formatExerciseLabel } from '@/utils/labels'
import { sessionResult } from '@/utils/sessionResult'
import { estimateCafeteroStars } from '@/utils/estimatedStars'
import { computeSessionStats } from '@/utils/patientStats'
import { computeExerciseLevelPerformance, computeExercisePerformance, type PerformanceTrend } from '@/utils/exercisePerformance'
import { computePatientConclusions, formatConclusionsText } from '@/utils/patientConclusions'
import { drawLevelChart, drawRatingCircles } from './pdfCharts'

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

    // Desempeño por actividad (ejercicio/minijuego) — el análisis central del portal
    const exerciseRows = computeExercisePerformance(filtered, r.game)
    if (exerciseRows.length > 0) {
      subheading('Desempeño por Actividad')

      autoTable(doc, {
        startY: y + 6,
        margin: { left: marginX, right: marginX },
        head: [['Ejercicio', 'Sesiones', 'Ganadas', 'Rendimiento', 'Duración prom.', 'Velocidad', 'Errores', 'Tendencia']],
        body: exerciseRows.map((ex) => [
          formatExerciseLabel(ex.exercise),
          String(ex.count),
          ex.winRate === null
            ? 'No registrado'
            : `${ex.wins} de ${ex.wins + ex.losses} (${ex.winRate}%)${ex.highestLevelWon === null ? '' : `\nNivel más alto: ${formatDifficultyLabel(ex.highestLevelWon)}`}`,
          ex.avgScorePercent === null ? 'No disponible' : `${ex.avgScorePercent}%`,
          formatDurationEs(ex.avgDurationSeconds),
          ex.avgDurationPercent === null ? 'No disponible' : `${ex.avgDurationPercent}%`,
          ex.avgErrors === null && ex.arms === null
            ? 'No registrado'
            : [ex.avgErrors === null ? null : `${ex.avgErrors} por intento`, ex.arms === null ? null : `Izq. ${ex.arms.left} · Der. ${ex.arms.right}`].filter(Boolean).join('\n'),
          ex.trend === null ? 'Insuficiente' : `${TREND_LABEL[ex.trend]}${ex.trendLevel === null ? '' : `\n(${formatDifficultyLabel(ex.trendLevel)})`}`,
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [90, 90, 90], textColor: 255 },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 20

      // No hay un gráfico que compare un ejercicio contra otro: cada ejercicio mide una tarea distinta con
      // su propia escala, y un % de una tarea contra un % de otra no dice en cuál rinde mejor el usuario.

      // Una fila por minijuego con una gráfica por nivel de dificultad, todas en la misma
      // escala 0-100 % para comparar el rendimiento entre niveles del MISMO minijuego
      // (mismo dato que ExerciseLevelCharts en la UI).
      ensureSpace(140) // que el título no quede solo al final de una página, sin su primera fila de gráficas
      subheading('Rendimiento por nivel de dificultad (% del máximo de cada nivel)')
      y += 12
      const chartColumnWidth = contentWidth / 3
      for (const ex of computeExerciseLevelPerformance(filtered, r.game)) {
        ensureSpace(100)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(50, 50, 50)
        doc.text(formatExerciseLabel(ex.exercise), marginX, y)
        y += 14

        const bottoms = ex.levels.map((level, i) =>
          drawLevelChart(doc, {
            x: marginX + i * chartColumnWidth,
            y,
            width: chartColumnWidth - 14,
            height: 46,
            title: `${formatDifficultyLabel(level.level)} · ${level.count} ses.${level.avgScorePercent === null ? '' : ` · prom. ${level.avgScorePercent}%`}`,
            values: level.points.map((p) => p.scorePercent),
            color: gameColor,
            emptyMessage: level.count === 0 ? 'Sin sesiones en este nivel' : 'Sin puntaje registrado',
          }),
        )
        y = Math.max(...bottoms) + 16

        if (ex.unknownLevelCount > 0) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.setTextColor(140, 140, 140)
          doc.text(`${ex.unknownLevelCount} ses. de este minijuego sin nivel de dificultad registrado no se grafican.`, marginX, y - 6)
          y += 8
        }
      }
      y += 8
    }

    // Detalle de sesiones (dato crudo, para trazabilidad completa)
    ensureSpace(30)
    subheading('Detalle de sesiones')

    const starInfos = filtered.map(getStarInfo)

    autoTable(doc, {
      startY: y + 6,
      margin: { left: marginX, right: marginX },
      head: [['Fecha', 'Ejercicio', 'Dificultad', 'Puntaje', 'Estrellas', 'Duración', 'Resultado', 'Errores']],
      body: filtered.map((s, i) => {
        const info = starInfos[i]
        return [
          formatDateEs(s.date),
          formatExerciseLabel(s.exercise),
          formatDifficultyLabel(s.difficulty),
          s.score === null ? 'No disponible' : String(s.score),
          info === null ? 'No aplica' : '', // se dibuja con círculos en didDrawCell
          formatDurationEs(s.durationSeconds),
          resultLabel(s),
          s.metrics === null || s.metrics.errors === null ? 'No registrado' : String(s.metrics.errors),
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

function resultLabel(s: NormalizedSession): string {
  const result = sessionResult(s)
  return result === null ? 'No registrado' : result === 'win' ? 'Ganó' : 'Perdió'
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const num = parseInt(clean, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}
