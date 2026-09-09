import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

export interface HeaderParent {
  label: string
  to: string
}

export function Header({ title, parent, onMenuClick }: { title: string; parent?: HeaderParent; onMenuClick?: () => void }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const initials = (profile?.displayName || profile?.email || '?').slice(0, 2).toUpperCase()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-ink-200 bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onMenuClick} className="rounded-lg p-2 text-ink-500 hover:bg-ink-50 md:hidden" aria-label="Abrir menú">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <div>
          {parent && (
            <Link to={parent.to} className="mb-0.5 flex items-center gap-1 text-xs font-medium text-ink-400 transition-colors hover:text-seam-700">
              <span aria-hidden="true">←</span> {parent.label}
            </Link>
          )}
          <h1 className="text-lg font-semibold text-ink-900">{title}</h1>
        </div>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-ink-50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-seam-100 text-xs font-semibold text-seam-700">
            {initials}
          </div>
          <div className="hidden text-left sm:block">
            <div className="text-sm font-medium text-ink-800">{profile?.displayName || 'Administrador'}</div>
            <div className="text-xs text-ink-400">{profile?.email}</div>
          </div>
        </button>

        {open && (
          <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-ink-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              className="block w-full px-4 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
              onClick={() => {
                setOpen(false)
                navigate('/perfil')
              }}
            >
              Mi perfil
            </button>
            <button
              type="button"
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              onClick={() => signOut()}
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
