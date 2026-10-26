import { describe, expect, it, vi } from 'vitest'
import { makeSession } from '@/test/fixtures'
import { EMPTY_FILTERS } from '@/utils/sessionFilters'
import type { ConsolidatedProfile } from '@/types/game'
import { generatePatientReportPdf } from './PatientReport'

// jsPDF.save abre una descarga del navegador: se reemplaza por una que guarda los bytes del PDF para revisarlos.
const saved = vi.hoisted(() => [] as { name: string; bytes: Uint8Array }[])
vi.mock('jspdf', async (importOriginal) => {
  const original = await importOriginal<typeof import('jspdf')>()
  class CapturingJsPDF extends original.default {
    constructor(...args: ConstructorParameters<typeof original.default>) {
      super(...args)
      const self = this as unknown as { save: (name: string) => unknown; output: (type: string) => ArrayBuffer }
      self.save = (name: string) => {
        saved.push({ name, bytes: new Uint8Array(self.output('arraybuffer')) })
        return this
      }
    }
  }
  return { ...original, default: CapturingJsPDF, jsPDF: CapturingJsPDF }
})

describe('generatePatientReportPdf', () => {
  it('genera un PDF válido con sesiones de Cafetero y Amazonas (tablas y gráficos incluidos)', () => {
    const coffee = (['easy', 'medium', 'hard'] as const).flatMap((difficulty, i) =>
      [true, false].map((isWin, j) =>
        makeSession({ game: 'game3', exercise: 'CoffeeCollection', difficulty, isWin, score: 1000 + i * 100 + j, durationSeconds: 60 + j, date: '2026-10-02', hour: `09:0${i}:0${j}`, scoreModel: 2 }),
      ),
    )
    const profile: ConsolidatedProfile = {
      identifier: '900000001',
      results: [
        { game: 'game1', state: 'FOUND', user: null, sessions: [makeSession({ game: 'game1', exercise: 'exercise1', score: 50, stars: 2 })] },
        { game: 'game2', state: 'NOT_FOUND', user: null, sessions: [] },
        { game: 'game3', state: 'FOUND', user: null, sessions: coffee },
      ],
    }
    generatePatientReportPdf({ profile, filters: EMPTY_FILTERS, generatedByEmail: 'qa@seam.com' })
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('SEAM_reporte_900000001.pdf')
    expect(String.fromCharCode(...saved[0].bytes.slice(0, 5))).toBe('%PDF-')
    expect(saved[0].bytes.length).toBeGreaterThan(2000)
  })
})
