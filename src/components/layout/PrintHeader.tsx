import { useLocation } from 'react-router-dom'
import { useCurrentSession } from '../../state/CurrentSessionContext'
import { NAV_ITEMS } from './navItems'

/** Only visible when printing (see .print-page-title in index.css) — the
 * TopBar/session-picker chrome is hidden on print, so this stands in for it. */
export function PrintHeader() {
  const { pathname } = useLocation()
  const { currentSession } = useCurrentSession()
  const match = NAV_ITEMS.find((item) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)))

  return (
    <div className="print-page-title mb-4 border-b border-border pb-2">
      <p className="text-lg font-semibold text-ink">LoadBoard — {match?.label ?? ''}</p>
      {currentSession && (
        <p className="text-sm text-ink-secondary">
          {currentSession.date} · {currentSession.label} · {currentSession.type === 'match' ? 'Partita' : 'Allenamento'}
        </p>
      )}
    </div>
  )
}
