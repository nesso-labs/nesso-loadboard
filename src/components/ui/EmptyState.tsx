import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

/** Used both for "no data at all yet" and "not enough history yet" states. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <Icon className="size-8 text-ink-muted" strokeWidth={1.5} />
      <p className="text-base font-medium text-ink">{title}</p>
      <p className="max-w-sm text-sm text-ink-secondary">{description}</p>
      {action}
    </div>
  )
}
