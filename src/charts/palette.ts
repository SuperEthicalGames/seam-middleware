/**
 * Paleta validada (dataviz skill) — categórica para identidad de juego, y de estado
 * (fijo, nunca reutilizado para series) para activo/inactivo.
 */
export const GAME_COLORS: Record<'game1' | 'game2' | 'game3', string> = {
  game1: '#2a78d6', // categórica slot 1 — blue
  game2: '#eb6834', // categórica slot 2 — orange
  game3: '#1baf7a', // categórica slot 3 — aqua
}

export const STATUS_COLORS = {
  good: '#0ca30c',
  critical: '#d03b3b',
  muted: '#898781',
}

export const CHART_INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  surface: '#fcfcfb',
}
