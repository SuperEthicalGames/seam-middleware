import type jsPDF from 'jspdf'

/**
 * Gráficos y elementos visuales para el PDF, dibujados con las primitivas
 * vectoriales de jsPDF (rect/circle/line) — nunca con el carácter "★" ni con
 * flechas Unicode (↑↓→): las fuentes estándar de jsPDF (helvetica) solo soportan
 * WinAnsiEncoding y esos símbolos se renderizan como glifos rotos con espaciado
 * incorrecto (verificado renderizando el PDF real, no solo en la consola).
 */

const EMPTY_CIRCLE_COLOR: [number, number, number] = [220, 220, 220]

/** Círculos de calificación (equivalente vectorial a las estrellas de la UI). */
export function drawRatingCircles(doc: jsPDF, x: number, y: number, filled: number, total: number, color: [number, number, number]) {
  const radius = 2.6
  const gap = 7.5
  for (let i = 0; i < total; i++) {
    const cx = x + i * gap + radius
    if (i < filled) {
      doc.setFillColor(...color)
      doc.circle(cx, y, radius, 'F')
    } else {
      doc.setDrawColor(...EMPTY_CIRCLE_COLOR)
      doc.setLineWidth(0.5)
      doc.circle(cx, y, radius, 'S')
    }
  }
}

export interface BarDatum {
  label: string
  value: number
  displayValue: string
}

/** Gráfico de barras horizontales simple. Devuelve el `y` final para encadenar layout. */
export function drawHorizontalBarChart(
  doc: jsPDF,
  opts: { x: number; y: number; width: number; labelWidth: number; data: BarDatum[]; max: number; color: [number, number, number] },
): number {
  const { x, y, width, labelWidth, data, max, color } = opts
  const barHeight = 10
  const barGap = 6
  const trackWidth = width - labelWidth - 45
  let cursorY = y

  for (const d of data) {
    const filledWidth = max > 0 ? Math.max(1.5, (Math.max(0, d.value) / max) * trackWidth) : 0

    doc.setFontSize(8.5)
    doc.setTextColor(70, 70, 70)
    doc.text(d.label, x, cursorY + barHeight - 2.5, { maxWidth: labelWidth - 6 })

    doc.setFillColor(235, 235, 232)
    doc.roundedRect(x + labelWidth, cursorY, trackWidth, barHeight, 1.5, 1.5, 'F')
    doc.setFillColor(...color)
    doc.roundedRect(x + labelWidth, cursorY, filledWidth, barHeight, 1.5, 1.5, 'F')

    doc.setTextColor(40, 40, 40)
    doc.text(d.displayValue, x + labelWidth + trackWidth + 6, cursorY + barHeight - 2.5)

    cursorY += barHeight + barGap
  }

  return cursorY
}

/** Espacio que `drawLevelChart` deja entre su título y el área de trazado. */
const LEVEL_CHART_TITLE_HEIGHT = 8

/**
 * Mini gráfica de líneas de UN nivel de dificultad de UN minijuego (equivalente a
 * LevelProgressChart de la UI): un punto por sesión, de la más antigua a la más
 * reciente, en escala fija 0-100 % para que las 3 gráficas de un minijuego se lean
 * una junto a otra. Con una sola sesión dibuja solo el punto; sin sesiones, el mensaje
 * `emptyMessage`. Devuelve el `y` del borde inferior del área de trazado.
 */
export function drawLevelChart(
  doc: jsPDF,
  opts: {
    x: number
    y: number
    width: number
    height: number
    title: string
    values: number[]
    color: [number, number, number]
    emptyMessage: string
  },
): number {
  const { x, y, width, height, title, values, color, emptyMessage } = opts
  const axisLabelWidth = 18
  const plotX = x + axisLabelWidth
  const plotWidth = width - axisLabelWidth
  const top = y + LEVEL_CHART_TITLE_HEIGHT
  const bottom = top + height

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(50, 50, 50)
  doc.text(title, x, y)

  // Ejes y línea de referencia al 50 %: hairlines sólidas y recesivas, igual que en la UI.
  doc.setDrawColor(225, 224, 217)
  doc.setLineWidth(0.5)
  doc.line(plotX, top, plotX, bottom)
  doc.line(plotX, bottom, plotX + plotWidth, bottom)
  doc.line(plotX, top + height / 2, plotX + plotWidth, top + height / 2)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(140, 140, 140)
  doc.text('100%', plotX - 2, top + 2, { align: 'right' })
  doc.text('50%', plotX - 2, top + height / 2 + 2, { align: 'right' })
  doc.text('0%', plotX - 2, bottom + 2, { align: 'right' })

  if (values.length === 0) {
    doc.setFontSize(7.5)
    doc.text(emptyMessage, plotX + plotWidth / 2, top + height / 2 + 3, { align: 'center', maxWidth: plotWidth - 8 })
    return bottom
  }

  const pad = 8
  const stepX = values.length > 1 ? (plotWidth - 2 * pad) / (values.length - 1) : 0
  const pointX = (i: number) => (values.length > 1 ? plotX + pad + i * stepX : plotX + plotWidth / 2)
  const pointY = (v: number) => bottom - (Math.max(0, Math.min(100, v)) / 100) * height

  doc.setDrawColor(...color)
  doc.setLineWidth(1.1)
  for (let i = 1; i < values.length; i++) {
    doc.line(pointX(i - 1), pointY(values[i - 1]), pointX(i), pointY(values[i]))
  }

  doc.setFillColor(...color)
  for (let i = 0; i < values.length; i++) {
    doc.circle(pointX(i), pointY(values[i]), 1.8, 'F')
  }

  // Solo el último punto lleva su valor — el resto se lee contra el eje.
  const last = values.length - 1
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(40, 40, 40)
  doc.text(`${values[last]}%`, pointX(last), pointY(values[last]) - 4, { align: 'center' })
  doc.setFont('helvetica', 'normal')

  return bottom
}
