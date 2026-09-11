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
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-ink-muted">
        <span>{label}</span>
        {icon}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn('text-2xl font-semibold tabular-nums text-ink', accent && 'text-accent')}>{value}</span>
        {unit && <span className="text-sm text-ink-secondary">{unit}</span>}
      </div>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}
