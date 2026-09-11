import { Users } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '../components/ui/EmptyState'
import {
  accHighCount,
  decHighCount,
  distanceAbove19_8,
  distanceAbove25_2,
  mechanicalWork,
  mechanicalWorkPerMin,
  sprintCount,
} from '../lib/metrics/metricsCatalog'
import { median, percentileRank } from '../lib/metrics/heatmap'
import { useCurrentSession } from '../state/CurrentSessionContext'
import { usePlayersQuery, useSegmentsBySessionQuery, useSettingsQuery } from '../state/queries'
import type { DrillSegment } from '../types/domain'

const PLAYER_COLORS = ['var(--color-series-blue)', 'var(--color-series-orange)', 'var(--color-series-aqua)']
const MAX_PLAYERS = 3

interface MetricSpec {
  key: string
  label: string
  unit: string
  getValue: (s: DrillSegment) => number
  format?: (v: number) => string
}

export function ComparePage() {
  const { currentSession } = useCurrentSession()
  const { data: segments = [], isLoading } = useSegmentsBySessionQuery(currentSession?.id)
  const { data: players = [] } = usePlayersQuery()
  const { data: settings } = useSettingsQuery()
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const playerById = new Map(players.map((p) => [p.id, p]))

  if (!currentSession || isLoading || !settings) return null

  const fullSessionSegs = segments.filter((s) => s.segmentKind === 'full_session')

  if (fullSessionSegs.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nessun dato per questa sessione"
        description="Serve almeno una riga 'Full Session' per confrontare i giocatori."
      />
    )
  }

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id)
      if (prev.length >= MAX_PLAYERS) return prev
      return [...prev, id]
    })
  }

  const selectedSegs = selectedIds
    .map((id) => fullSessionSegs.find((s) => s.playerId === id))
    .filter((s): s is DrillSegment => !!s)

  const sections: { title: string; metrics: MetricSpec[] }[] = [
    {
      title: 'Volume',
      metrics: [
        { key: 'td', label: 'Distanza totale', unit: 'm', getValue: (s) => s.totalDistanceM },
        { key: 'tdmin', label: 'Distanza / min', unit: 'm/min', getValue: (s) => s.distancePerMin, format: (v) => v.toFixed(1) },
        { key: 'dur', label: 'Durata', unit: 'min', getValue: (s) => s.durationSec / 60 },
      ],
    },
    {
      title: 'Alta velocità',
      metrics: [
        { key: 'hsr', label: 'HSR (>19.8 km/h)', unit: 'm', getValue: distanceAbove19_8 },
        { key: 'sprintd', label: 'Sprint (>25.2 km/h)', unit: 'm', getValue: distanceAbove25_2 },
        { key: 'nsprint', label: '# Sprint', unit: '', getValue: (s) => sprintCount(s, settings) },
        { key: 'vmax', label: 'Velocità massima', unit: 'km/h', getValue: (s) => s.maxSpeedKmh, format: (v) => v.toFixed(1) },
      ],
    },
    {
      title: 'Meccanico',
      metrics: [
        { key: 'mechw', label: 'Mechanical Work', unit: '#', getValue: (s) => mechanicalWork(s, settings) },
        { key: 'mechwmin', label: 'MechW / min', unit: '#/min', getValue: (s) => mechanicalWorkPerMin(s, settings), format: (v) => v.toFixed(2) },
        { key: 'acchigh', label: 'Acc. alta', unit: '#', getValue: (s) => accHighCount(s, settings) },
        { key: 'dechigh', label: 'Dec. alta', unit: '#', getValue: (s) => decHighCount(s, settings) },
      ],
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium text-ink-secondary">Scegli fino a {MAX_PLAYERS} giocatori</p>
        <div className="flex flex-wrap gap-2">
          {fullSessionSegs.map((s) => {
            const idx = selectedIds.indexOf(s.playerId)
            const isSelected = idx >= 0
            return (
              <button
                key={s.playerId}
                type="button"
                onClick={() => toggle(s.playerId)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isSelected ? 'border-transparent text-white' : 'border-border text-ink-secondary hover:bg-ink/5'
                }`}
                style={isSelected ? { backgroundColor: PLAYER_COLORS[idx] } : undefined}
              >
                {playerById.get(s.playerId)?.displayName ?? s.playerId}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Il confronto si ferma a tre giocatori per scelta: sono i colori che restano distinguibili anche con
          daltonismo.
        </p>
      </div>

      {selectedSegs.length === 0 ? (
        <EmptyState icon={Users} title="Seleziona almeno un giocatore" description="Scegli fino a 3 giocatori sopra per confrontarli." />
      ) : (
        <>
          <div className="flex items-center gap-4 text-xs">
            {selectedSegs.map((s, i) => (
              <div key={s.playerId} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: PLAYER_COLORS[i] }} />
                <span className="font-medium text-ink">{playerById.get(s.playerId)?.displayName}</span>
              </div>
            ))}
            <span className="text-ink-muted">La riga grigia sulle barre è la mediana squadra (n={fullSessionSegs.length})</span>
          </div>

          {sections.map((section) => (
            <div key={section.title} className="panel p-4">
              <p className="font-display mb-3 text-base font-medium text-ink">{section.title}</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {section.metrics.map((metric) => {
                  const allValues = fullSessionSegs.map(metric.getValue)
                  const teamMedian = median(allValues)
                  const format = metric.format ?? ((v: number) => v.toFixed(0))
                  const maxScale = Math.max(...allValues, 1)
                  return (
                    <div key={metric.key} className="flex flex-col gap-1.5">
                      <p className="text-xs font-medium text-ink-secondary">
                        {metric.label} {metric.unit && <span className="text-ink-muted">({metric.unit})</span>}
                      </p>
                      {selectedSegs.map((seg, i) => {
                        const value = metric.getValue(seg)
                        const pct = percentileRank(value, allValues)
                        return (
                          <div key={seg.playerId} className="flex items-center gap-2 text-xs">
                            <div className="relative h-4 flex-1 rounded bg-ink/5">
                              <div
                                className="h-4 rounded"
                                style={{ width: `${Math.min(100, (value / maxScale) * 100)}%`, backgroundColor: PLAYER_COLORS[i] }}
                              />
                              <div
                                className="absolute top-0 h-4 w-px bg-ink-muted"
                                style={{ left: `${Math.min(100, (teamMedian / maxScale) * 100)}%` }}
                              />
                            </div>
                            <span className="w-24 shrink-0 text-right tabular-nums text-ink">
                              {format(value)} <span className="text-ink-muted">({pct.toFixed(0)}°)</span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
