/** Logo oficial de SEAM — ícono de corazón recortado del archivo de marca provisto por el cliente. */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { box: 'h-7 w-7', word: 'text-sm' },
    md: { box: 'h-9 w-9', word: 'text-base' },
    lg: { box: 'h-12 w-12', word: 'text-xl' },
  }[size]

  return (
    <div className="flex items-center gap-2.5">
      <img src={`${import.meta.env.BASE_URL}seam-heart.webp`} alt="SEAM" className={`${sizes.box} shrink-0 rounded-lg object-cover shadow-sm`} />
      <div className="leading-none">
        <div className={`font-semibold tracking-tight text-ink-900 ${sizes.word}`}>SEAM</div>
        <div className="text-[10px] uppercase tracking-wider text-ink-400">Middleware</div>
      </div>
    </div>
  )
}

/** Composición completa (corazón + wordmark + tagline) para contextos hero como el login. */
export function LogoHero({ className = 'h-40 w-40' }: { className?: string }) {
  return <img src={`${import.meta.env.BASE_URL}seam-logo-full.webp`} alt="SEAM — Cuidamos lo mejor de ti" className={`${className} mx-auto drop-shadow-sm`} />
}
