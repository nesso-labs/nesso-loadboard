import { ChevronDown, Menu, Printer, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCurrentSession } from '../../state/CurrentSessionContext'
import { NAV_ITEMS } from './navItems'

function useCurrentPageLabel(): string {
  const { pathname } = useLocation()
  const match = NAV_ITEMS.find((item) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)))
  return match?.label ?? 'LoadBoard'
}

export function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const pageLabel = useCurrentPageLabel()
  const { sessions, currentSessionId, currentSession, setCurrentSessionId } = useCurrentSession()
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <header className="no-print flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        className="rounded-md p-1.5 text-ink-secondary hover:bg-ink/5 md:hidden"
        onClick={onOpenMobileNav}
        aria-label="Apri menu"
      >
        <Menu className="size-5" />
      </button>

      <h1 className="font-display truncate text-base font-medium text-ink">{pageLabel}</h1>

      <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
        {sessions.length > 0 && (
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-ink/5 sm:gap-1.5 sm:px-3"
            >
              <span className="max-w-24 truncate sm:max-w-44">
                {currentSession ? currentSession.label : 'Seleziona sessione'}
              </span>
              <ChevronDown className="size-3.5 shrink-0" />
            </button>
            {pickerOpen && (
              <div className="absolute right-0 z-40 mt-1 w-64 border border-border bg-surface-raised py-1 shadow-lg">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setCurrentSessionId(s.id)
                      setPickerOpen(false)
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-ink/5 ${
                      s.id === currentSessionId ? 'text-accent' : 'text-ink-secondary'
                    }`}
                  >
                    <span className="truncate">{s.label}</span>
                    <span className="ml-2 shrink-0 tabular-nums text-ink-muted">{s.date}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => window.print()}
          aria-label="Stampa / esporta PDF"
          className="hidden items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-ink/5 md:flex"
        >
          <Printer className="size-3.5" />
          Stampa / PDF
        </button>

        <Link
          to="/sessions"
          aria-label="Importa sessione"
          className="glow-accent flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-2 py-1.5 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90 sm:px-3"
        >
          <Upload className="size-3.5" />
          <span className="hidden sm:inline">Importa sessione</span>
        </Link>
      </div>
    </header>
  )
}
