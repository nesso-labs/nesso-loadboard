import { Swords } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ComparisonBar } from '../components/ui/ComparisonBar'
import { EmptyState } from '../components/ui/EmptyState'
import { distanceAbove19_8, distanceAbove25_2, mechanicalWork } from '../lib/metrics/metricsCatalog'
import { currentMicrocycleSessions } from '../lib/metrics/microcycle'
import { performanceModelAverage } from '../lib/metrics/performanceModel'
import {
  PERFORMANCE_MODEL_ALPHA,
  PERFORMANCE_MODEL_METRICS as METRICS,
  WEEKLY_TARGET_MULTIPLIER as TARGET_MULTIPLIER,
  type PerformanceModelMetricSpec as MetricSpec,
} from '../lib/metrics/weeklyPerformanceModel'
import { mean } from '../lib/utils'
import { useCurrentSession } from '../state/CurrentSessionContext'
import { useAllSegmentsQuery, usePlayersQuery, useSessionsQuery, useSettingsQuery } from '../state/queries'
import { TRAINING_TYPE_LABEL, type DrillSegment } from '../types/domain'

const TEAM_ID = '__team__'

type ChartKind = 'training-vs-game' | 'intensity' | 'weekly-model'

const CHART_KIND_ORDER: ChartKind[] = ['training-vs-game', 'intensity', 'weekly-model']
const CHART_KIND_LABEL: Record<ChartKind, string> = {
  'training-vs-game': 'Allenamento vs Gara',
  intensity: 'Intensità',
  'weekly-model': 'Modello prestativo settimanale',
}

interface EntityData {
  id: string
  label: string
  trainingFullSegs: DrillSegment[]
  gameSegs: DrillSegment[]
  gamePerformanceModel: Record<string, number>
  postMatchValue: (volume: (s: DrillSegment) => number) => number
}

export function SessionVGamePage() {
  const { currentSession } = useCurrentSession()
  const { data: sessions = [] } = useSessionsQuery()
  const { data: rawSegments = [], isLoading } = useAllSegmentsQuery()
  const { data: players = [] } = usePlayersQuery()
  const { data: settings } = useSettingsQuery()
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | undefined>(undefined)
  const [selectedKinds, setSelectedKinds] = useState<ChartKind[]>([...CHART_KIND_ORDER])

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const activePlayerIds = useMemo(() => new Set(players.filter((p) => p.active).map((p) => p.id)), [players])
  // Deactivated players never show up again, anywhere on this page, until reactivated in Roster & Positions.
  const segments = useMemo(() => rawSegments.filter((s) => activePlayerIds.has(s.playerId)), [rawSegments, activePlayerIds])

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

  const trainingSessionSegsAll = segments.filter((s) => s.sessionId === activeTraining.id)
  const trainingFullSegsAll = trainingSessionSegsAll.filter((s) => s.segmentKind === 'full_session')
  const matchCount = matchSessionIds.size

  const toggleKind = (kind: ChartKind) => {
    setSelectedKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]))
  }

  if (trainingFullSegsAll.length === 0) {
    return (
      <EmptyState
        icon={Swords}
        title="Nessun dato di sessione completa"
        description="Serve almeno una riga 'Full Session' in questo allenamento per confrontare volume e intensità con la media delle gare."
      />
    )
  }

  const playerOptions = [...new Set(trainingFullSegsAll.map((s) => s.playerId))].sort((a, b) =>
    (playerById.get(a)?.displayName ?? a).localeCompare(playerById.get(b)?.displayName ?? b),
  )
  const otherDrillTitles = [...new Set(trainingSessionSegsAll.map((s) => s.drillTitle))]

  const mechWorkSpec: MetricSpec = {
    key: 'mechw',
    label: 'Mechanical Work',
    unit: '#',
    volume: (s) => mechanicalWork(s, settings),
  }
  const allMetrics = [...METRICS, mechWorkSpec]

  // Post-match cumulative load: every training since the last match, summed per player.
  const microcycleSessionIds = new Set(currentMicrocycleSessions(sessions).map((s) => s.id))
  const postMatchFullSegs = segments.filter(
    (s) => s.segmentKind === 'full_session' && microcycleSessionIds.has(s.sessionId),
  )

  const buildEntity = (id: string, label: string, playerId: string | undefined): EntityData => {
    const trainingFullSegs = playerId ? trainingFullSegsAll.filter((s) => s.playerId === playerId) : trainingFullSegsAll
    const entityGameSegs = playerId ? gameSegs.filter((s) => s.playerId === playerId) : gameSegs

    // "Gara" volumes: the historical performance model (mean of every valid
    // match appearance's volume normalized to 90' via power law) — falls back
    // to the raw mean only if no appearance clears the 15'-played floor.
    const gamePerformanceModel: Record<string, number> = {}
    for (const m of METRICS) {
      gamePerformanceModel[m.key] =
        performanceModelAverage(entityGameSegs, m.volume, PERFORMANCE_MODEL_ALPHA[m.key]) ??
        mean(entityGameSegs.map(m.volume))
    }

    const postMatchValue = (volume: (s: DrillSegment) => number): number => {
      if (playerId) {
        return postMatchFullSegs.filter((s) => s.playerId === playerId).reduce((sum, s) => sum + volume(s), 0)
      }
      const sumByPlayer = new Map<string, number>()
      for (const seg of postMatchFullSegs) {
        sumByPlayer.set(seg.playerId, (sumByPlayer.get(seg.playerId) ?? 0) + volume(seg))
      }
      const sums = [...sumByPlayer.values()]
      return sums.length > 0 ? mean(sums) : 0
    }

    return { id, label, trainingFullSegs, gameSegs: entityGameSegs, gamePerformanceModel, postMatchValue }
  }

  const entities: EntityData[] = [
    buildEntity(TEAM_ID, 'Media squadra', undefined),
    ...playerOptions.map((id) => buildEntity(id, playerById.get(id)?.displayName ?? id, id)),
  ]

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

      <div>
        <p className="mb-2 text-sm font-medium text-ink-secondary">Grafici da visualizzare</p>
        <div className="flex flex-wrap gap-2">
          {CHART_KIND_ORDER.map((kind) => {
            const isSelected = selectedKinds.includes(kind)
            return (
              <button
                key={kind}
                type="button"
                onClick={() => toggleKind(kind)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'border-transparent bg-primary text-primary-ink'
                    : 'border-border text-ink-secondary hover:bg-ink/5'
                }`}
              >
                {CHART_KIND_LABEL[kind]}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-sm text-ink-secondary">
        Allenamento selezionato confrontato con la media di {matchCount} {matchCount === 1 ? 'partita' : 'partite'} —
        media squadra e ogni giocatore, uno accanto all'altro.
      </p>

      {selectedKinds.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="Nessun grafico selezionato"
          description="Scegli almeno uno dei tre grafici sopra per vedere i dati."
        />
      ) : (
        <>
          {selectedKinds.includes('training-vs-game') && (
            <section className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">Allenamento vs Gara</p>
                <p className="text-xs text-ink-muted">
                  "Gara" è il modello prestativo medio storico: ogni presenza in gara (esclusi subentri sotto i 15')
                  viene normalizzata a 90' con una legge di potenza, poi mediata sull'intero storico.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {entities.map((entity) => (
                  <div key={entity.id} className={entity.id === TEAM_ID ? 'panel-accent p-4' : 'panel p-4'}>
                    <p className="mb-3 text-sm font-medium text-ink">{entity.label}</p>
                    <div className="flex flex-col gap-3">
                      {allMetrics.map((m) => (
                        <ComparisonBar
                          key={m.key}
                          label={m.label}
                          unit={m.unit}
                          primaryLabel="Allenamento"
                          primaryValue={mean(entity.trainingFullSegs.map(m.volume))}
                          referenceLabel="Gara"
                          referenceValue={
                            m.key in entity.gamePerformanceModel
                              ? entity.gamePerformanceModel[m.key]
                              : mean(entity.gameSegs.map(m.volume))
                          }
                          showRatio
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {selectedKinds.includes('intensity') && (
            <section className="flex flex-col gap-4">
              <p className="text-sm font-semibold text-ink">Intensità (per minuto)</p>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {entities.map((entity) => {
                  const perMin = (m: MetricSpec) => (s: DrillSegment) =>
                    s.durationSec > 0 ? m.volume(s) / (s.durationSec / 60) : 0
                  return (
                    <div key={entity.id} className={entity.id === TEAM_ID ? 'panel-accent p-4' : 'panel p-4'}>
                      <p className="mb-3 text-sm font-medium text-ink">{entity.label}</p>
                      <div className="flex flex-col gap-3">
                        {allMetrics.map((m) => (
                          <ComparisonBar
                            key={m.key}
                            label={m.label}
                            unit={`${m.unit}/min`}
                            primaryLabel="Allenamento"
                            primaryValue={mean(entity.trainingFullSegs.map(perMin(m)))}
                            referenceLabel="Gara"
                            referenceValue={mean(entity.gameSegs.map(perMin(m)))}
                            format={(v) => v.toFixed(1)}
                            showRatio
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {selectedKinds.includes('weekly-model') && (
            <section className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">Modello prestativo settimanale</p>
                <p className="text-xs text-ink-muted">
                  Confronta il carico cumulato negli allenamenti svolti dall'ultima partita a oggi contro un target
                  teorico: 2.5x il modello gara per il volume totale, 1.5x per le distanze ad alta velocità.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {entities.map((entity) => (
                  <div key={entity.id} className={entity.id === TEAM_ID ? 'panel-accent p-4' : 'panel p-4'}>
                    <p className="mb-3 text-sm font-medium text-ink">{entity.label}</p>
                    <div className="flex flex-col gap-3">
                      {METRICS.map((m) => (
                        <ComparisonBar
                          key={m.key}
                          label={m.label}
                          unit={m.unit}
                          primaryLabel="Post-gara"
                          primaryValue={entity.postMatchValue(m.volume)}
                          referenceLabel="Target"
                          referenceValue={entity.gamePerformanceModel[m.key] * TARGET_MULTIPLIER[m.key]}
                          showRatio
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div>
            <p className="mb-3 text-sm font-semibold text-ink">
              Riepilogo per drill (media squadra) — {activeTraining.label}
            </p>
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
                    const rows = trainingSessionSegsAll.filter((s) => s.drillTitle === title)
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
