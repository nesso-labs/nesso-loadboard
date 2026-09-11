interface ComparisonBarProps {
  label: string
  unit?: string
  primaryLabel: string
  primaryValue: number
  referenceLabel: string
  referenceValue: number
  format?: (value: number) => string
}

/** Two horizontal bars (this session vs a reference) sharing one scale. */
export function ComparisonBar({
  label,
  unit,
  primaryLabel,
  primaryValue,
  referenceLabel,
  referenceValue,
  format = (v) => v.toFixed(0),
}: ComparisonBarProps) {
  const max = Math.max(primaryValue, referenceValue, 1)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-ink-secondary">
        {label}
        {unit && <span className="ml-1 text-ink-muted">({unit})</span>}
      </p>
      <Bar label={primaryLabel} value={primaryValue} max={max} format={format} accent />
      <Bar label={referenceLabel} value={referenceValue} max={max} format={format} />
    </div>
  )
}

function Bar({
  label,
  value,
  max,
  format,
  accent,
}: {
  label: string
  value: number
  max: number
  format: (v: number) => string
  accent?: boolean
}) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 truncate text-ink-secondary">{label}</span>
      <div className="h-4 flex-1 rounded bg-ink/5">
        <div
          className={`h-4 rounded ${accent ? 'bg-accent' : 'bg-ink-muted'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-ink">{format(value)}</span>
    </div>
  )
}
