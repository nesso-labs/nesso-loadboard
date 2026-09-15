import { ClipboardList } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '../components/ui/EmptyState'
import { distanceAbove19_8, distanceAbove25_2, mechanicalWork } from '../lib/metrics/metricsCatalog'
import { isoWeek, mean } from '../lib/utils'
import { useAllSegmentsQuery, usePlayersQuery, useSessionsQuery, useSettingsQuery } from '../state/queries'
import type { DrillSegment } from '../types/domain'

interface MetricSpec {
  key: string
  label: string
  unit: string
  getValue: (s: DrillSegment) => number
}

const METRICS: MetricSpec[] = [
  { key: 'totalDistanceM', label: 'Distanza totale', unit: 'm', getValue: (s) => s.totalDistanceM },
  { key: 'd198', label: 'Distanza > 19.8', unit: 'm', getValue: distanceAbove19_8 },
  { key: 'd252', label: 'Distanza > 25.2', unit: 'm', getValue: distanceAbove25_2 },
]

export function WeeklyRunningPage() {
  const { data: sessions = [], isLoading: loadingSessions } = useSessionsQuery()
  const { data: segments = [], isLoading: loadingSegments } = useAllSegmentsQuery()
  const { data: players = [] } = usePlayersQuery()
  const { data: settings } = useSettingsQuery()
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>(undefined)

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const activePlayerIds = useMemo(() => new Set(players.filter((p) => p.active).map((p) => p.id)), [players])

  if (loadingSessions || loadingSegments || !settings) return null

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nessuna sessione ancora importata"
        description="Importa almeno una sessione per iniziare a costruire il riepilogo settimanale."
      />
    )
  }

  const weeks = [...new Set(sessions.map((s) => isoWeek(s.date)))].sort().reverse()
  const activeWeek = selectedWeek ?? weeks[0]
  const sessionIdsInWeek = new Set(sessions.filter((s) => isoWeek(s.date) === activeWeek).map((s) => s.id))
  const weekSegments = segments.filter(
    (s) => s.segmentKind === 'full_session' && sessionIdsInWeek.has(s.sessionId) && activePlayerIds.has(s.playerId),
  )

  if (weekSegments.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nessun dato per questa settimana"
        description="Nessuna sessione con righe 'Full Session' nella settimana selezionata."
      />
    )
  }

  const mechWorkMetric: MetricSpec = { key: 'mechWork', label: 'Mechanical Work', unit: '#', getValue: (s) => mechanicalWork(s, settings) }
  const allMetrics = [...METRICS, mechWorkMetric]

  const weeklySumByPlayer = (metric: MetricSpec) => {
    const byPlayer = new Map<string, number>()
    for (const seg of weekSegments) {
      byPlayer.set(seg.playerId, (byPlayer.get(seg.playerId) ?? 0) + metric.getValue(seg))
    }
    return byPlayer
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-secondary">Somma settimanale per giocatore, come % di un riferimento.</p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-secondary">Settimana</span>
          <select
            value={activeWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-ink"
          >
            {weeks.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {allMetrics.map((metric) => {
          const byPlayer = weeklySumByPlayer(metric)
          const values = [...byPlayer.values()]
          const target = settings.weeklyTargets?.[metric.key] ?? mean(values)
          const rows = [...byPlayer.entries()]
            .map(([playerId, value]) => ({
              playerId,
              name: playerById.get(playerId)?.displayName ?? playerId,
              value,
              pct: target > 0 ? (value / target) * 100 : 0,
            }))
            .sort((a, b) => b.pct - a.pct)

          return (
            <div key={metric.key} className="panel p-4">
              <p className="mb-3 text-sm font-medium text-ink-secondary">
                {metric.label} <span className="text-ink-muted">({metric.unit})</span>
              </p>
              <div className="flex items-center gap-2 pb-2 text-xs font-semibold text-ink">
                <span className="w-28 shrink-0">Squadra</span>
                <div className="h-3 flex-1 rounded bg-ink/5">
                  <div className="h-3 rounded bg-accent" style={{ width: '100%' }} />
                </div>
                <span className="w-14 shrink-0 text-right tabular-nums">{target.toFixed(0)}</span>
              </div>
              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                {rows.map((row) => (
                  <div key={row.playerId} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 truncate text-ink-secondary">{row.name}</span>
                    <div className="h-3 flex-1 rounded bg-ink/5">
                      <div
                        className="h-3 rounded bg-ink-muted"
                        style={{ width: `${Math.min(100, row.pct)}%` }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right tabular-nums text-ink">{row.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
