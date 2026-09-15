import { Swords } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ComparisonBar } from '../components/ui/ComparisonBar'
import { EmptyState } from '../components/ui/EmptyState'
import { distanceAbove19_8, distanceAbove25_2, mechanicalWork, mechanicalWorkPerMin } from '../lib/metrics/metricsCatalog'
import { currentMicrocycleSessions } from '../lib/metrics/microcycle'
import { performanceModelAverage } from '../lib/metrics/performanceModel'
import { mean } from '../lib/utils'
import { useCurrentSession } from '../state/CurrentSessionContext'
import { useAllSegmentsQuery, usePlayersQuery, useSessionsQuery, useSettingsQuery } from '../state/queries'
import { TRAINING_TYPE_LABEL, type DrillSegment } from '../types/domain'

const TEAM_OPTION = '__team__'

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

/** Power-law taper for the 90'-normalization of a match appearance — steeper for high-speed metrics. */
const PERFORMANCE_MODEL_ALPHA: Record<string, number> = { td: 0.075, d198: 0.12, d252: 0.12 }

/** Post-match training target, as a multiple of the historical performance model. */
const TARGET_MULTIPLIER: Record<string, number> = { td: 2.5, d198: 1.5, d252: 1.5 }

export function SessionVGamePage() {
  const { currentSession } = useCurrentSession()
  const { data: sessions = [] } = useSessionsQuery()
  const { data: segments = [], isLoading } = useAllSegmentsQuery()
  const { data: players = [] } = usePlayersQuery()
  const { data: settings } = useSettingsQuery()
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | undefined>(undefined)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>(undefined)

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])

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

  const playerOptions = [...new Set(trainingFullSegsAll.map((s) => s.playerId))].sort((a, b) =>
    (playerById.get(a)?.displayName ?? a).localeCompare(playerById.get(b)?.displayName ?? b),
  )
  const activePlayerId = selectedPlayerId && playerOptions.includes(selectedPlayerId) ? selectedPlayerId : undefined
  const activePlayer = activePlayerId ? playerById.get(activePlayerId) : undefined

  const trainingSessionSegs = activePlayerId
    ? trainingSessionSegsAll.filter((s) => s.playerId === activePlayerId)
    : trainingSessionSegsAll
  const trainingFullSegs = activePlayerId
    ? trainingFullSegsAll.filter((s) => s.playerId === activePlayerId)
    : trainingFullSegsAll
  const playerGameSegs = activePlayerId ? gameSegs.filter((s) => s.playerId === activePlayerId) : gameSegs
  const otherDrillTitles = [...new Set(trainingSessionSegs.map((s) => s.drillTitle))]

  const mechWorkSpec: MetricSpec = {
    key: 'mechw',
    label: 'Mechanical Work',
    unit: '#',
    volume: (s) => mechanicalWork(s, settings),
  }
  const allMetrics = [...METRICS, mechWorkSpec]

  // "Gara" volumes: the historical performance model (mean of every valid
  // match appearance's volume normalized to 90' via power law) — falls back
  // to the raw mean only if no appearance clears the 15'-played floor.
  const gamePerformanceModel: Record<string, number> = {}
  for (const m of METRICS) {
    gamePerformanceModel[m.key] =
      performanceModelAverage(playerGameSegs, m.volume, PERFORMANCE_MODEL_ALPHA[m.key]) ??
      mean(playerGameSegs.map(m.volume))
  }

  // Post-match cumulative load: every training since the last match, summed
  // (not averaged) per player, then averaged across players for the team view.
  const microcycleSessionIds = new Set(currentMicrocycleSessions(sessions).map((s) => s.id))
  const postMatchFullSegs = segments.filter(
    (s) => s.segmentKind === 'full_session' && microcycleSessionIds.has(s.sessionId),
  )
  const postMatchSum = (volume: (s: DrillSegment) => number): number => {
    if (activePlayerId) {
      return postMatchFullSegs
        .filter((s) => s.playerId === activePlayerId)
        .reduce((sum, s) => sum + volume(s), 0)
    }
    const sumByPlayer = new Map<string, number>()
    for (const seg of postMatchFullSegs) {
      sumByPlayer.set(seg.playerId, (sumByPlayer.get(seg.playerId) ?? 0) + volume(seg))
    }
    const sums = [...sumByPlayer.values()]
    return sums.length > 0 ? mean(sums) : 0
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
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
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-secondary">Giocatore</span>
            <select
              value={activePlayerId ?? TEAM_OPTION}
              onChange={(e) => setSelectedPlayerId(e.target.value === TEAM_OPTION ? undefined : e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-ink"
            >
              <option value={TEAM_OPTION}>Tutta la squadra (media)</option>
              {playerOptions.map((id) => (
                <option key={id} value={id}>
                  {playerById.get(id)?.displayName ?? id}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-sm text-ink-secondary">
          Tipo di allenamento:{' '}
          <span className="font-medium text-ink">
            {activeTraining.trainingType ? TRAINING_TYPE_LABEL[activeTraining.trainingType] : 'Non classificato'}
          </span>
        </p>
      </div>

      <p className="text-sm text-ink-secondary">
        {activePlayer ? (
          <>
            Allenamento di <span className="font-medium text-ink">{activePlayer.displayName}</span> confrontato con
            la sua media personale su {playerGameSegs.length} {playerGameSegs.length === 1 ? 'partita' : 'partite'}{' '}
            disputate.
          </>
        ) : (
          <>
            Allenamento selezionato confrontato con la media di {matchCount} {matchCount === 1 ? 'partita' : 'partite'}{' '}
            — media per giocatore.
          </>
        )}
      </p>

      {trainingFullSegs.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="Nessun dato di sessione completa"
          description={
            activePlayer
              ? `${activePlayer.displayName} non ha una riga 'Full Session' in questo allenamento.`
              : "Serve almeno una riga 'Full Session' in questo allenamento per confrontare volume e intensità con la media delle gare."
          }
        />
      ) : activePlayer && playerGameSegs.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="Nessun dato di gara per questo giocatore"
          description={`${activePlayer.displayName} non risulta in nessuna sessione di tipo Partita con una riga 'Full Session'.`}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 panel p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="mb-1 text-sm font-semibold text-ink">Volume</p>
              <p className="mb-3 text-xs text-ink-muted">
                "Gara" è il modello prestativo medio storico: ogni presenza in gara (esclusi subentri sotto i 15')
                viene normalizzata a 90' con una legge di potenza, poi mediata sull'intero storico.
              </p>
            </div>
            {allMetrics.map((m) => (
              <ComparisonBar
                key={m.key}
                label={m.label}
                unit={m.unit}
                primaryLabel="Allenamento"
                primaryValue={mean(trainingFullSegs.map(m.volume))}
                referenceLabel="Gara"
                referenceValue={m.key in gamePerformanceModel ? gamePerformanceModel[m.key] : mean(playerGameSegs.map(m.volume))}
                showRatio
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
                  referenceValue={mean(playerGameSegs.map(perMin))}
                  format={(v) => v.toFixed(1)}
                  showRatio
                />
              )
            })}
            <ComparisonBar
              label="Mechanical Work"
              unit="#/min"
              primaryLabel="Allenamento"
              primaryValue={mean(trainingFullSegs.map((s) => mechanicalWorkPerMin(s, settings)))}
              referenceLabel="Gara"
              referenceValue={mean(playerGameSegs.map((s) => mechanicalWorkPerMin(s, settings)))}
              format={(v) => v.toFixed(2)}
              showRatio
            />
          </div>

          <div className="grid grid-cols-1 gap-4 panel p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="mb-1 text-sm font-semibold text-ink">Modello prestativo</p>
              <p className="mb-3 text-xs text-ink-muted">
                Confronta il carico cumulato negli allenamenti svolti dall'ultima partita a oggi contro un target
                teorico: 2.5x il modello gara per il volume totale, 1.5x per le distanze ad alta velocità.
              </p>
            </div>
            {METRICS.map((m) => (
              <ComparisonBar
                key={m.key}
                label={m.label}
                unit={m.unit}
                primaryLabel="Post-gara"
                primaryValue={postMatchSum(m.volume)}
                referenceLabel="Target"
                referenceValue={gamePerformanceModel[m.key] * TARGET_MULTIPLIER[m.key]}
                showRatio
              />
            ))}
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-ink">
              Riepilogo per drill ({activePlayer ? activePlayer.displayName : 'media squadra'}) — {activeTraining.label}
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
                    const rows = trainingSessionSegs.filter((s) => s.drillTitle === title)
                    const durationMin = mean(rows.map((s) => s.durationSec / 60))
                    const td = mean(rows.map((s) => s.totalDistanceM))
                    return (
                      <tr key={title} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium text-ink">
                          {title}
                          {!activePlayer && <span className="ml-2 text-xs text-ink-muted">({rows.length} giocatori)</span>}
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
