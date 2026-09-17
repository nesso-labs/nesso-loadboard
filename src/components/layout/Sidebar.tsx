import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useAuth } from '../../state/AuthContext'
import { NAV_ITEMS } from './navItems'

export function Sidebar({ className }: { className?: string }) {
  const { isAdmin } = useAuth()
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <nav className={cn('flex flex-col gap-0.5 overflow-y-auto', className)}>
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-r-md border-l-2 py-2 pl-3 pr-3 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary bg-primary/10 text-ink'
                : 'border-transparent text-ink-secondary hover:border-border hover:bg-ink/5 hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={cn('size-4 shrink-0', isActive && 'text-primary')} strokeWidth={1.75} />
              <span className="truncate">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
