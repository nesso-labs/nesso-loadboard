import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface TrendPoint {
  x: string
  value: number
  /** Team median for this same point (session + metric) — omit/null when there's no team data to compare against (e.g. a cross-workspace linked session). */
  median?: number | null
}

interface TrendLineProps {
  data: TrendPoint[]
  color?: string
  medianColor?: string
  height?: number
  valueFormatter?: (value: number) => string
}

/** Small "×" marker for the median series — visually distinct from the player's own filled dots. */
function CrossDot({ cx, cy, stroke }: { cx?: number; cy?: number; stroke?: string }) {
  if (cx === undefined || cy === undefined) return null
  const r = 3.5
  return (
    <g>
      <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} stroke={stroke} strokeWidth={1.5} />
      <line x1={cx - r} y1={cy + r} x2={cx + r} y2={cy - r} stroke={stroke} strokeWidth={1.5} />
    </g>
  )
}

/**
 * Player trend line (solid, filled dots) with an optional team-median overlay
 * (thinner, dashed, "×" markers, never highlighted on hover) — the median
 * series is purely a reference, so it stays visually recessive to the
 * player's own line. No legend: the panel title names the player's series,
 * a caption below the chart explains the dashed one when it's present.
 */
export function TrendLine({
  data,
  color = 'var(--color-series-blue)',
  medianColor = 'var(--color-ink-muted)',
  height = 160,
  valueFormatter,
}: TrendLineProps) {
  const hasMedian = data.some((d) => d.median !== undefined && d.median !== null)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-grid)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="x"
          tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
          axisLine={{ stroke: 'var(--color-baseline)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          formatter={(value, name) => {
            const n = Number(value)
            const formatted = valueFormatter ? valueFormatter(n) : n
            return [formatted, name === 'median' ? 'Mediana squadra' : 'Giocatore']
          }}
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        {hasMedian && (
          <Line
            type="monotone"
            dataKey="median"
            name="median"
            stroke={medianColor}
            strokeWidth={1}
            strokeDasharray="4 3"
            dot={<CrossDot />}
            activeDot={{ r: 4 }}
            connectNulls
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          name="value"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
