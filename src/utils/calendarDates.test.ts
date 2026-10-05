import { describe, expect, it } from 'vitest'
import { addDays, addMonths, longDateEs, mondayIndex, monthGrid, shiftMonthKeepingDay, weekdayNameEs } from './calendarDates'

describe('calendarDates', () => {
  it('addDays cruza mes y año', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('addMonths va al día 1 del mes pedido', () => {
    expect(addMonths('2026-10-17', 1)).toBe('2026-11-01')
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01')
  })

  it('shiftMonthKeepingDay recorta al último día del mes corto', () => {
    expect(shiftMonthKeepingDay('2026-01-31', 1)).toBe('2026-02-28')
    expect(shiftMonthKeepingDay('2026-03-15', -1)).toBe('2026-02-15')
  })

  it('octubre de 2026 empieza en jueves y el 2 es viernes', () => {
    const grid = monthGrid(2026, 9)
    expect(grid[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
    expect(grid.every((w) => w.length === 7)).toBe(true)
    expect(grid.flat().filter(Boolean)).toHaveLength(31)
    expect(weekdayNameEs('2026-10-02')).toBe('viernes')
    expect(mondayIndex('2026-10-02')).toBe(4)
    expect(longDateEs('2026-10-02')).toBe('2 de octubre de 2026')
  })
})
