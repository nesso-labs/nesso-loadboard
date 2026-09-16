import { Trophy } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '../components/ui/EmptyState'
import { distanceAbove19_8, distanceAbove25_2, mechanicalWork, sprintCount } from '../lib/metrics/metricsCatalog'
import { useCurrentSession } from '../state/CurrentSessionContext'
import { useAllSegmentsQuery, usePlayersQuery, useSessionsQuery, useSettingsQuery } from '../state/queries'
import type { DrillSegment } from '../types/domain'

interface MetricSpec {
  key: string
  label: string
  unit: string
  getValue: (s: DrillSegment) => number
  aggregate: 'sum' | 'max'
}

export function LeaderboardPage() {
  const { currentSession } = useCurrentSession()
  const { data: sessions = [] } = useSessionsQuery()
  const { data: segments = [], isLoading } = useAllSegmentsQuery()
  const { data: players = [] } = usePlayersQuery()
  const { data: settings } = useSettingsQuery()
  const [metricKey, setMetricKey] = useState('td')
  // Empty means "not touched by the user yet" — falls back to the current session's own date below,
  // so the default view still shows a single day (that session) rather than the whole history.
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  if (!currentSession || isLoading || !settings) return null

  const playerById = new Map(players.map((p) => [p.id, p]))
  const activePlayerIds = new Set(players.filter((p) => p.active).map((p) => p.id))

  const metrics: MetricSpec[] = [
    { key: 'td', label: 'Distanza totale', unit: 'm', getValue: (s) => s.totalDistanceM, aggregate: 'sum' },
    { key: 'd198', label: 'Distanza > 19.8 km/h', unit: 'm', getValue: distanceAbove19_8, aggregate: 'sum' },
    { key: 'd252', label: 'Distanza > 25.2 km/h', unit: 'm', getValue: distanceAbove25_2, aggregate: 'sum' },
    { key: 'sprints', label: 'Sprint', unit: '#', getValue: (s) => sprintCount(s, settings), aggregate: 'sum' },
    { key: 'mechw', label: 'Mechanical Work', unit: '#', getValue: (s) => mechanicalWork(s, settings), aggregate: 'sum' },
    { key: 'vmax', label: 'Velocità massima', unit: 'km/h', getValue: (s) => s.maxSpeedKmh, aggregate: 'max' },
  ]
  const metric = metrics.find((m) => m.key === metricKey)!

  const effectiveStart = startDate || currentSession.date
  const effectiveEnd = endDate || currentSession.date

  const scopeSessionIds = new Set(
    sessions.filter((s) => s.date >= effectiveStart && s.date <= effectiveEnd).map((s) => s.id),
  )

  const scopedSegs = segments.filter(
    (s) => s.segmentKind === 'full_session' && scopeSessionIds.has(s.sessionId) && activePlayerIds.has(s.playerId),
  )

  if (scopedSegs.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Nessun dato per questo periodo"
        description="Nessuna riga 'Full Session' trovata tra le date selezionate."
      />
    )
  }

  const byPlayer = new Map<string, number[]>()
  for (const seg of scopedSegs) {
    const list = byPlayer.get(seg.playerId) ?? []
    list.push(metric.getValue(seg))
    byPlayer.set(seg.playerId, list)
  }

  const rows = [...byPlayer.entries()]
    .map(([playerId, values]) => ({
      playerId,
      name: playerById.get(playerId)?.displayName ?? playerId,
      position: playerById.get(playerId)?.position,
      value: metric.aggregate === 'sum' ? values.reduce((a, b) => a + b, 0) : Math.max(...values),
    }))
    .sort((a, b) => b.value - a.value)

  const maxValue = Math.max(...rows.map((r) => r.value), 1)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-secondary">Metrica</span>
          <select
            value={metricKey}
            onChange={(e) => setMetricKey(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-ink"
          >
            {metrics.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-secondary">Da</span>
          <input
            type="date"
            value={effectiveStart}
            max={effectiveEnd}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-ink"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-secondary">A</span>
          <input
            type="date"
            value={effectiveEnd}
            min={effectiveStart}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-ink"
          />
        </label>
      </div>

      <div className="panel p-4">
        <div className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <div key={row.playerId} className="flex items-center gap-3 text-sm">
              <span className="w-6 shrink-0 text-right font-semibold tabular-nums text-ink-muted">{i + 1}</span>
              <span className="w-28 shrink-0 truncate font-medium text-ink">{row.name}</span>
              <div className="h-4 flex-1 rounded bg-ink/5">
                <div
                  className={`h-4 rounded ${i < 3 ? 'bg-accent' : 'bg-ink-muted'}`}
                  style={{ width: `${(row.value / maxValue) * 100}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right tabular-nums text-ink">
                {row.value.toFixed(metric.unit === 'km/h' ? 1 : 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
