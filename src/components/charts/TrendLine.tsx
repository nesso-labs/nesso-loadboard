import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface TrendPoint {
  x: string
  value: number
}

interface TrendLineProps {
  data: TrendPoint[]
  color?: string
  height?: number
  valueFormatter?: (value: number) => string
}

/**
 * Single-series line — one hue, thin line, hover tooltip, recessive grid.
 * No legend: a single series is named by the panel title, not a legend box.
 */
export function TrendLine({ data, color = 'var(--color-series-blue)', height = 160, valueFormatter }: TrendLineProps) {
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
          formatter={(value) => {
            const n = Number(value)
            return valueFormatter ? valueFormatter(n) : n
          }}
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
