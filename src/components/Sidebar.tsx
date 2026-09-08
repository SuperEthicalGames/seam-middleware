import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'

interface NavItem {
  to: string
  label: string
  icon: (props: { className?: string }) => JSX.Element
}

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}
function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
  )
}
function IconGames({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="6" width="20" height="12" rx="4" />
      <path d="M7 12h4M9 10v4M15.5 13h.01M18 11h.01" strokeLinecap="round" />
    </svg>
  )
}
function IconKey({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8M16 7l2 2M19 4l1 1" strokeLinecap="round" />
    </svg>
  )
}
function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" strokeLinecap="round" />
      <path d="M16 8.2a3.2 3.2 0 110 6.4M22 20c-.7-2.4-2-4-4-5" strokeLinecap="round" />
    </svg>
  )
}
function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" strokeLinejoin="round" />
    </svg>
  )
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: IconDashboard },
  { to: '/buscar', label: 'Buscar paciente', icon: IconSearch },
  { to: '/juegos', label: 'Juegos', icon: IconGames },
  { to: '/seriales', label: 'Seriales', icon: IconKey },
  { to: '/administradores', label: 'Administradores', icon: IconUsers },
  { to: '/auditoria', label: 'Auditoría', icon: IconShield },
]

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-seam-50 text-seam-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
              }`
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-ink-100 p-4 text-[11px] leading-relaxed text-ink-400">
        SEAM Middleware v0.1
        <br />
        Uso interno — no distribuir.
      </div>
    </>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-200 bg-white md:flex">
      <div className="flex h-16 items-center border-b border-ink-100 px-5">
        <Logo />
      </div>
      <SidebarNav />
    </aside>
  )
}
