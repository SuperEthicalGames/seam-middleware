/**
 * Wordmark tipográfico provisional — no se recibió el archivo del logo real de SEAM.
 * Reemplazar por el logo oficial en cuanto el cliente lo entregue (ver LIMITATIONS.md).
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { box: 'h-7 w-7', text: 'text-sm', word: 'text-sm' },
    md: { box: 'h-9 w-9', text: 'text-base', word: 'text-base' },
    lg: { box: 'h-12 w-12', text: 'text-xl', word: 'text-xl' },
  }[size]

  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex ${sizes.box} items-center justify-center rounded-lg bg-gradient-to-br from-seam-500 to-seam-700 font-bold text-white ${sizes.text}`}>
        S
      </div>
      <div className="leading-none">
        <div className={`font-semibold tracking-tight text-ink-900 ${sizes.word}`}>SEAM</div>
        <div className="text-[10px] uppercase tracking-wider text-ink-400">Middleware</div>
      </div>
    </div>
  )
}
