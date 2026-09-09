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

/** Línea de progreso simple (equivalente al ScoreTrendChart de la UI). */
export function drawLineChart(doc: jsPDF, opts: { x: number; y: number; width: number; height: number; values: number[]; color: [number, number, number] }): number {
  const { x, y, width, height, values, color } = opts
  const bottom = y + height

  doc.setDrawColor(225, 224, 217)
  doc.setLineWidth(0.5)
  doc.line(x, y, x, bottom)
  doc.line(x, bottom, x + width, bottom)

  if (values.length < 2) {
    doc.setFontSize(8.5)
    doc.setTextColor(140, 140, 140)
    doc.text('No hay suficientes sesiones con puntaje para graficar el progreso.', x + 8, y + height / 2)
    return bottom + 24
  }

  const max = Math.max(...values, 1)
  const stepX = width / (values.length - 1)

  doc.setDrawColor(...color)
  doc.setLineWidth(1.1)
  let prevX = x
  let prevY = bottom - (values[0] / max) * height
  for (let i = 1; i < values.length; i++) {
    const px = x + i * stepX
    const py = bottom - (values[i] / max) * height
    doc.line(prevX, prevY, px, py)
    prevX = px
    prevY = py
  }

  doc.setFillColor(...color)
  for (let i = 0; i < values.length; i++) {
    const px = x + i * stepX
    const py = bottom - (values[i] / max) * height
    doc.circle(px, py, 1.3, 'F')
  }

  doc.setFontSize(7.5)
  doc.setTextColor(140, 140, 140)
  doc.text('0', x - 2, bottom + 8, { align: 'right' })
  doc.text(String(max), x - 2, y + 3, { align: 'right' })

  return bottom + 24
}
