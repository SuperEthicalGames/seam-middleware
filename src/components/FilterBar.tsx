import type { SessionFilters } from '@/utils/sessionFilters'
import { EMPTY_FILTERS } from '@/utils/sessionFilters'

export function FilterBar({ value, onChange }: { value: SessionFilters; onChange: (next: SessionFilters) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-200 bg-white p-4">
      <div>
        <label className="label" htmlFor="filter-from">
          Fecha inicial
        </label>
        <input
          id="filter-from"
          type="date"
          className="input"
          value={value.dateFrom}
          onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor="filter-to">
          Fecha final
        </label>
        <input id="filter-to" type="date" className="input" value={value.dateTo} onChange={(e) => onChange({ ...value, dateTo: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="filter-difficulty">
          Dificultad
        </label>
        <select
          id="filter-difficulty"
          className="input"
          value={value.difficulty}
          onChange={(e) => onChange({ ...value, difficulty: e.target.value as SessionFilters['difficulty'] })}
        >
          <option value="all">Todas</option>
          <option value="easy">Fácil</option>
          <option value="medium">Media</option>
          <option value="hard">Difícil</option>
          <option value="unknown">Desconocida</option>
        </select>
      </div>
      <div className="min-w-[180px] flex-1">
        <label className="label" htmlFor="filter-exercise">
          Ejercicio
        </label>
        <input
          id="filter-exercise"
          type="text"
          className="input"
          placeholder="Ej. exercise1, CoffeeWash..."
          value={value.exerciseQuery}
          onChange={(e) => onChange({ ...value, exerciseQuery: e.target.value })}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={() => onChange(EMPTY_FILTERS)}>
          Limpiar filtros
        </button>
      </div>
    </div>
  )
}
