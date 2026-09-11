import { Swords } from 'lucide-react'
import { ComparisonBar } from '../components/ui/ComparisonBar'
import { EmptyState } from '../components/ui/EmptyState'
import {
  distanceAbove19_8,
  distanceAbove25_2,
  isGameLikeDrill,
  mechanicalWork,
  mechanicalWorkPerMin,
} from '../lib/metrics/metricsCatalog'
import { mean } from '../lib/utils'
import { useCurrentSession } from '../state/CurrentSessionContext'
import { useSegmentsBySessionQuery, useSettingsQuery } from '../state/queries'
import type { DrillSegment } from '../types/domain'

interface MetricSpec {
  key: string
  label: string
  unit: string
  volume: (s: DrillSegment) => number
  format?: (v: number) => string
}

const METRICS: MetricSpec[] = [
  { key: 'td', label: 'Distanza totale', unit: 'm', volume: (s) => s.totalDistanceM },
  { key: 'd198', label: 'Distanza > 19.8 km/h', unit: 'm', volume: distanceAbove19_8 },
  { key: 'd252', label: 'Distanza > 25.2 km/h', unit: 'm', volume: distanceAbove25_2 },
]

export function SessionVGamePage() {
  const { currentSession } = useCurrentSession()
  const { data: segments = [], isLoading } = useSegmentsBySessionQuery(currentSession?.id)
  const { data: settings } = useSettingsQuery()

  if (!currentSession || isLoading || !settings) return null

  const fullSessionSegs = segments.filter((s) => s.segmentKind === 'full_session')
  const gameSegs = segments.filter((s) => isGameLikeDrill(s.drillTitle, settings))
  const otherDrillTitles = [...new Set(segments.map((s) => s.drillTitle))]

  if (fullSessionSegs.length === 0) {
    return (
      <EmptyState
        icon={Swords}
        title="Nessun dato di sessione completa"
        description="Serve almeno una riga 'Full Session' per confrontare volume e intensità con il drill di riferimento."
      />
    )
  }

  if (gameSegs.length === 0) {
    return (
      <EmptyState
        icon={Swords}
        title="Nessun drill 'di gara' individuato"
        description="Nessuno dei drill di questa sessione corrisponde alle parole chiave configurate per 'partita/gara' (impostabili in Settings). Mostro solo i dati della sessione."
      />
    )
  }

  const mechWorkSpec: MetricSpec = {
    key: 'mechw',
    label: 'Mechanical Work',
    unit: '#',
    volume: (s) => mechanicalWork(s, settings),
  }
  const allMetrics = [...METRICS, mechWorkSpec]

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-secondary">
        Sessione confrontata con il drill "di gara" individuato:{' '}
        <span className="font-medium text-ink">{gameSegs[0]?.drillTitle}</span> — media per giocatore.
      </p>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <p className="mb-3 text-sm font-semibold text-ink">Volume</p>
        </div>
        {allMetrics.map((m) => (
          <ComparisonBar
            key={m.key}
            label={m.label}
            unit={m.unit}
            primaryLabel="Sessione"
            primaryValue={mean(fullSessionSegs.map(m.volume))}
            referenceLabel="Gara"
            referenceValue={mean(gameSegs.map(m.volume))}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <p className="mb-3 text-sm font-semibold text-ink">Intensità (per minuto)</p>
        </div>
        {allMetrics.map((m) => {
          const perMin = (s: DrillSegment) => (s.durationSec > 0 ? m.volume(s) / (s.durationSec / 60) : 0)
          return (
            <ComparisonBar
              key={m.key}
              label={m.label}
              unit={`${m.unit}/min`}
              primaryLabel="Sessione"
              primaryValue={mean(fullSessionSegs.map(perMin))}
              referenceLabel="Gara"
              referenceValue={mean(gameSegs.map(perMin))}
              format={(v) => v.toFixed(1)}
            />
          )
        })}
        <ComparisonBar
          label="Mechanical Work"
          unit="#/min"
          primaryLabel="Sessione"
          primaryValue={mean(fullSessionSegs.map((s) => mechanicalWorkPerMin(s, settings)))}
          referenceLabel="Gara"
          referenceValue={mean(gameSegs.map((s) => mechanicalWorkPerMin(s, settings)))}
          format={(v) => v.toFixed(2)}
        />
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-ink">Riepilogo per drill (media squadra)</p>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2">Drill</th>
                <th className="px-3 py-2 text-right">Durata (min)</th>
                <th className="px-3 py-2 text-right">TD (m)</th>
                <th className="px-3 py-2 text-right">D&gt;19.8 (m)</th>
                <th className="px-3 py-2 text-right">D&gt;25.2 (m)</th>
                <th className="px-3 py-2 text-right">MechW (#)</th>
                <th className="px-3 py-2 text-right">TD (m/min)</th>
              </tr>
            </thead>
            <tbody>
              {otherDrillTitles.map((title) => {
                const rows = segments.filter((s) => s.drillTitle === title)
                const durationMin = mean(rows.map((s) => s.durationSec / 60))
                const td = mean(rows.map((s) => s.totalDistanceM))
                return (
                  <tr key={title} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium text-ink">
                      {title}
                      <span className="ml-2 text-xs text-ink-muted">({rows.length} giocatori)</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{durationMin.toFixed(0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{td.toFixed(0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">
                      {mean(rows.map(distanceAbove19_8)).toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">
                      {mean(rows.map(distanceAbove25_2)).toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">
                      {mean(rows.map((s) => mechanicalWork(s, settings))).toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">
                      {durationMin > 0 ? (td / durationMin).toFixed(1) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
