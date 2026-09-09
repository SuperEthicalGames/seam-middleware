/** Select compacto para controles de filtro/orden sobre un gráfico — mismo estilo en los 4 que lo usan. */
export function ChartSelect<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="w-full max-w-[190px]">
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-400">
        {label}
      </label>
      <select id={id} className="input py-1.5 text-xs" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
