import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SessionType } from '../../types/domain'

export interface TrendBarPoint {
  date: string
  label: string
  value: number
  type: SessionType
}

interface MetricTrendPanelProps {
  title: string
  unit?: string
  points: TrendBarPoint[]
  rolling: number[]
  latestValue?: number
  format?: (value: number) => string
}

/**
 * One metric's small-multiple: a bar per session (darker = match, lighter =
 * training — identity by fill, not hue, since these are the same series)
 * plus a rolling-average line overlay. Same Y axis for both (never dual-axis).
 */
export function MetricTrendPanel({ title, unit, points, rolling, latestValue, format = (v) => v.toFixed(0) }: MetricTrendPanelProps) {
  const data = points.map((p, i) => ({ ...p, rolling: rolling[i] }))

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          {title}
          {unit && <span className="ml-1 normal-case">({unit})</span>}
        </p>
        {latestValue !== undefined && (
          <span className="text-sm font-semibold tabular-nums text-ink">{format(latestValue)}</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} axisLine={{ stroke: 'var(--color-baseline)' }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            formatter={(value, name) => [format(Number(value)), name === 'rolling' ? 'Media mobile' : 'Sessione']}
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {data.map((point, i) => (
              <Cell key={i} fill={point.type === 'match' ? 'var(--color-ink-secondary)' : 'var(--color-baseline)'} />
            ))}
          </Bar>
          <Line type="monotone" dataKey="rolling" stroke="var(--color-series-red)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
