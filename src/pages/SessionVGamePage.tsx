import { Swords } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ComparisonBar } from '../components/ui/ComparisonBar'
import { EmptyState } from '../components/ui/EmptyState'
import { distanceAbove19_8, distanceAbove25_2, mechanicalWork, mechanicalWorkPerMin } from '../lib/metrics/metricsCatalog'
import { mean } from '../lib/utils'
import { useCurrentSession } from '../state/CurrentSessionContext'
import { useAllSegmentsQuery, useSessionsQuery, useSettingsQuery } from '../state/queries'
import { TRAINING_TYPE_LABEL, type DrillSegment } from '../types/domain'

interface MetricSpec {
  key: string
  label: string
  unit: string
  volume: (s: DrillSegment) => number
}

const METRICS: MetricSpec[] = [
  { key: 'td', label: 'Distanza totale', unit: 'm', volume: (s) => s.totalDistanceM },
  { key: 'd198', label: 'Distanza > 19.8 km/h', unit: 'm', volume: distanceAbove19_8 },
  { key: 'd252', label: 'Distanza > 25.2 km/h', unit: 'm', volume: distanceAbove25_2 },
]

export function SessionVGamePage() {
  const { currentSession } = useCurrentSession()
  const { data: sessions = [] } = useSessionsQuery()
  const { data: segments = [], isLoading } = useAllSegmentsQuery()
  const { data: settings } = useSettingsQuery()
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | undefined>(undefined)

  const trainingSessions = useMemo(
    () => sessions.filter((s) => s.type === 'training').sort((a, b) => b.date.localeCompare(a.date)),
    [sessions],
  )
  const matchSessionIds = useMemo(() => new Set(sessions.filter((s) => s.type === 'match').map((s) => s.id)), [sessions])

  if (isLoading || !settings) return null

  const defaultTrainingId = (currentSession?.type === 'training' ? currentSession.id : undefined) ?? trainingSessions[0]?.id
  const activeTrainingId = selectedTrainingId ?? defaultTrainingId
  const activeTraining = trainingSessions.find((s) => s.id === activeTrainingId)

  const gameSegs = segments.filter((s) => s.segmentKind === 'full_session' && matchSessionIds.has(s.sessionId))

  if (trainingSessions.length === 0) {
    return (
      <EmptyState
        icon={Swords}
        title="Nessun allenamento disponibile"
        description="Serve almeno una sessione di tipo Allenamento per confrontarla con la media delle gare."
      />
    )
  }

  if (gameSegs.length === 0) {
    return (
      <EmptyState
        icon={Swords}
        title="Nessuna gara importata"
        description="Serve almeno una sessione di tipo Partita, con una riga 'Full Session' per giocatore, per calcolare la media di riferimento."
      />
    )
  }

  if (!activeTraining) return null

  const trainingSessionSegs = segments.filter((s) => s.sessionId === activeTraining.id)
  const trainingFullSegs = trainingSessionSegs.filter((s) => s.segmentKind === 'full_session')
  const otherDrillTitles = [...new Set(trainingSessionSegs.map((s) => s.drillTitle))]
  const matchCount = matchSessionIds.size

  const mechWorkSpec: MetricSpec = {
    key: 'mechw',
    label: 'Mechanical Work',
    unit: '#',
    volume: (s) => mechanicalWork(s, settings),
  }
  const allMetrics = [...METRICS, mechWorkSpec]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-secondary">Allenamento</span>
          <select
            value={activeTraining.id}
            onChange={(e) => setSelectedTrainingId(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-ink"
          >
            {trainingSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.date} — {s.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-ink-secondary">
          Tipo di allenamento:{' '}
          <span className="font-medium text-ink">
            {activeTraining.trainingType ? TRAINING_TYPE_LABEL[activeTraining.trainingType] : 'Non classificato'}
          </span>
        </p>
      </div>

      <p className="text-sm text-ink-secondary">
        Allenamento selezionato confrontato con la media di {matchCount} {matchCount === 1 ? 'partita' : 'partite'} —
        media per giocatore.
      </p>

      {trainingFullSegs.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="Nessun dato di sessione completa"
          description="Serve almeno una riga 'Full Session' in questo allenamento per confrontare volume e intensità con la media delle gare."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 panel p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="mb-3 text-sm font-semibold text-ink">Volume</p>
            </div>
            {allMetrics.map((m) => (
              <ComparisonBar
                key={m.key}
                label={m.label}
                unit={m.unit}
                primaryLabel="Allenamento"
                primaryValue={mean(trainingFullSegs.map(m.volume))}
                referenceLabel="Gara"
                referenceValue={mean(gameSegs.map(m.volume))}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 panel p-5 md:grid-cols-2">
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
                  primaryLabel="Allenamento"
                  primaryValue={mean(trainingFullSegs.map(perMin))}
                  referenceLabel="Gara"
                  referenceValue={mean(gameSegs.map(perMin))}
                  format={(v) => v.toFixed(1)}
                />
              )
            })}
            <ComparisonBar
              label="Mechanical Work"
              unit="#/min"
              primaryLabel="Allenamento"
              primaryValue={mean(trainingFullSegs.map((s) => mechanicalWorkPerMin(s, settings)))}
              referenceLabel="Gara"
              referenceValue={mean(gameSegs.map((s) => mechanicalWorkPerMin(s, settings)))}
              format={(v) => v.toFixed(2)}
            />
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-ink">Riepilogo per drill (media squadra) — {activeTraining.label}</p>
            <div className="overflow-x-auto panel">
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
                    const rows = trainingSessionSegs.filter((s) => s.drillTitle === title)
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
        </>
      )}
    </div>
  )
}
