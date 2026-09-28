import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TrendPoint } from './TrendLine'

interface TrendBarsProps {
  data: TrendPoint[]
  color?: string
  medianColor?: string
  height?: number
  valueFormatter?: (value: number) => string
}

/**
 * Per-session bars for the player's own value alongside the team median for
 * that same session — used instead of TrendLine for short, session-by-session
 * windows (e.g. "ultimi 7 giorni") where a per-day comparison reads more
 * clearly as bars than as a two-point line.
 */
export function TrendBars({
  data,
  color = 'var(--color-series-blue)',
  medianColor = 'var(--color-ink-muted)',
  height = 160,
  valueFormatter,
}: TrendBarsProps) {
  const hasMedian = data.some((d) => d.median !== undefined && d.median !== null)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
        <Bar dataKey="value" name="value" fill={color} radius={[3, 3, 0, 0]} />
        {hasMedian && <Bar dataKey="median" name="median" fill={medianColor} fillOpacity={0.5} radius={[3, 3, 0, 0]} />}
      </BarChart>
    </ResponsiveContainer>
  )
}
