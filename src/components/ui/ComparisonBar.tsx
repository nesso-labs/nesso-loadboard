interface ComparisonBarProps {
  label: string
  unit?: string
  primaryLabel: string
  primaryValue: number
  referenceLabel: string
  referenceValue: number
  format?: (value: number) => string
}

/** Two horizontal bars (this session vs a reference) sharing one scale — one hue each, so the pair reads at a glance without relying on the text labels alone. */
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
      <Bar
        label={primaryLabel}
        value={primaryValue}
        max={max}
        format={format}
        color="var(--color-series-blue)"
        glowClass="glow-blue"
      />
      <Bar
        label={referenceLabel}
        value={referenceValue}
        max={max}
        format={format}
        color="var(--color-series-yellow)"
        glowClass="glow-accent"
      />
    </div>
  )
}

function Bar({
  label,
  value,
  max,
  format,
  color,
  glowClass,
}: {
  label: string
  value: number
  max: number
  format: (v: number) => string
  color: string
  glowClass: string
}) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 truncate text-ink-secondary">{label}</span>
      <div className="h-4 flex-1 rounded-full bg-ink/5">
        <div
          className={`h-4 rounded-full ${glowClass}`}
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-14 shrink-0 text-right font-bold tabular-nums text-ink">{format(value)}</span>
    </div>
  )
}
