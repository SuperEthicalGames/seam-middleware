import { GAME_CATALOG, GAME_IDS } from '@/config/games'
import type { GameId } from '@/types/game'
import { ChartSelect } from './ChartSelect'

export type GameFilter = GameId | 'all'

export function GameFilterSelect({ id, value, onChange }: { id: string; value: GameFilter; onChange: (value: GameFilter) => void }) {
  return (
    <ChartSelect
      id={id}
      label="Juego"
      value={value}
      onChange={onChange}
      options={[{ value: 'all', label: 'Todos los juegos' }, ...GAME_IDS.map((g) => ({ value: g, label: GAME_CATALOG[g].displayName }))]}
    />
  )
}
