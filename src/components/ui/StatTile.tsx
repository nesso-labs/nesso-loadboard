import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface StatTileProps {
  label: string
  value: string
  unit?: string
  hint?: string
  accent?: boolean
  icon?: ReactNode
}

export function StatTile({ label, value, unit, hint, accent, icon }: StatTileProps) {
  return (
    <div className={cn('flex flex-col gap-1.5 p-4', accent ? 'panel-accent' : 'panel')}>
      <div className="flex items-center justify-between text-sm text-ink-secondary">
        <span>{label}</span>
        {icon}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn('font-display text-3xl font-semibold tabular-nums leading-none text-ink', accent && 'text-accent')}
        >
          {value}
        </span>
        {unit && <span className="text-sm text-ink-secondary">{unit}</span>}
      </div>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}
