import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { NAV_ITEMS } from './navItems'

export function Sidebar({ className }: { className?: string }) {
  return (
    <nav className={cn('flex flex-col gap-0.5 overflow-y-auto', className)}>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 border-l-2 py-2 pl-3 pr-3 text-sm font-medium transition-colors',
              isActive
                ? 'border-accent bg-accent/10 text-ink'
                : 'border-transparent text-ink-secondary hover:border-border hover:bg-ink/5 hover:text-ink',
            )
          }
        >
          <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
