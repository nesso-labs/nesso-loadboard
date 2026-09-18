import { ShieldCheck, UserCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TrendLine } from '../components/charts/TrendLine'
import { ComparisonBar } from '../components/ui/ComparisonBar'
import { EmptyState } from '../components/ui/EmptyState'
import { StatTile } from '../components/ui/StatTile'
import { computeSessionAlerts, type AlertSeverity, type DatedFullSession } from '../lib/metrics/alerts'
import {
  distanceAbove19_8,
  distanceAbove25_2,
  MICROCYCLE_METRICS,
  mechanicalWork,
  sprintCount,
} from '../lib/metrics/metricsCatalog'
import { computeMicrocycleCompletion } from '../lib/metrics/microcycle'
import { formatNumber } from '../lib/utils'
import { computeWeeklyPerformanceModel } from '../lib/metrics/weeklyPerformanceModel'
import { useCurrentSession } from '../state/CurrentSessionContext'
import { useAllSegmentsQuery, usePlayersQuery, useRpeBySessionQuery, useSegmentsByPlayerQuery, useSettingsQuery } from '../state/queries'
import { TRAINING_TYPE_LABEL, type DrillSegment, type Session } from '../types/domain'

const DENOMINATOR_CAPTION: Record<string, string> = {
  'valid-cycles': 'vs media dei microcicli storici completi (Ripresa+Forza+Metabolico+Rifinitura)',
  'per-type-fallback': 'vs media per tipologia — nessun microciclo storico completo ancora disponibile',
  'insufficient-data': 'dati storici insufficienti per un confronto',
}

const SEVERITY_STYLE: Record<AlertSeverity, string> = {
  critical: 'bg-status-critical/15 text-status-critical',
  serious: 'bg-status-serious/20 text-status-serious',
  warning: 'bg-status-warning/20 text-ink',
}

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: 'Critico',
  serious: 'Serio',
  warning: 'Attenzione',
}

interface TrendMetricSpec {
  key: string
  label: string
  unit: string
  getValue: (s: DrillSegment) => number
}

/** Training rows show date + training type (the generic import label isn't useful on its own); matches keep their opponent-based label. */
function sessionHistoryLabel(session: Session): string {
  if (session.type !== 'training') return session.label
  const typeLabel = session.trainingType ? TRAINING_TYPE_LABEL[session.trainingType] : 'Non classificato'
  return `${session.date} — ${typeLabel}`
}

export function PlayerProfilePage() {
  const { data: players = [], isLoading: loadingPlayers } = usePlayersQuery()
  const { sessions, currentSession } = useCurrentSession()
  const { data: settings } = useSettingsQuery()
  const { data: allSegments = [] } = useAllSegmentsQuery()
  const { data: currentSessionRpe = [] } = useRpeBySessionQuery(currentSession?.id)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [trendMetricKey, setTrendMetricKey] = useState('td')
  // Session ids excluded from the trend line above — everything is included by default,
  // so this only ever grows from the "deselect a row" checkboxes in the table below.
  const [excludedSegIds, setExcludedSegIds] = useState<Set<string>>(new Set())

  const activeRosterPlayers = useMemo(() => players.filter((p) => p.active), [players])
  const activePlayerId = selectedId && activeRosterPlayers.some((p) => p.id === selectedId) ? selectedId : activeRosterPlayers[0]?.id
  const { data: segments = [], isLoading: loadingSegments } = useSegmentsByPlayerQuery(activePlayerId)

  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions])
  const player = activeRosterPlayers.find((p) => p.id === activePlayerId)

  if (loadingPlayers) return null

  if (activeRosterPlayers.length === 0) {
    return (
      <EmptyState
        icon={UserCircle}
        title="Nessun giocatore ancora"
        description="I giocatori vengono creati automaticamente al primo import di un CSV."
      />
    )
  }

  const fullSessionSegs = segments
    .filter((s) => s.segmentKind === 'full_session')
    .map((s) => ({ segment: s, session: sessionById.get(s.sessionId) }))
    .filter((row): row is { segment: (typeof segments)[number]; session: NonNullable<(typeof row)['session']> } => !!row.session)
    .sort((a, b) => a.session.date.localeCompare(b.session.date))

  const trendMetrics: TrendMetricSpec[] = [
    { key: 'td', label: 'Distanza totale', unit: 'm', getValue: (s) => s.totalDistanceM },
    { key: 'hsr', label: 'Distanza > 19.8 km/h', unit: 'm', getValue: distanceAbove19_8 },
    { key: 'sprintd', label: 'Distanza > 25.2 km/h', unit: 'm', getValue: distanceAbove25_2 },
    { key: 'vmax', label: 'Velocità massima', unit: 'km/h', getValue: (s) => s.maxSpeedKmh },
    ...(settings
      ? [
          { key: 'sprints', label: 'Sprint', unit: '#', getValue: (s: DrillSegment) => sprintCount(s, settings) },
          { key: 'mechw', label: 'Mechanical Work', unit: '#', getValue: (s: DrillSegment) => mechanicalWork(s, settings) },
        ]
      : []),
  ]
  const trendMetric = trendMetrics.find((m) => m.key === trendMetricKey) ?? trendMetrics[0]

  const toggleSegSelection = (id: string) => {
    setExcludedSegIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const chartRows = fullSessionSegs.filter((r) => !excludedSegIds.has(r.segment.id))

  const sessionCount = new Set(segments.map((s) => s.sessionId)).size
  const avgDistance =
    fullSessionSegs.length > 0 ? fullSessionSegs.reduce((sum, r) => sum + r.segment.totalDistanceM, 0) / fullSessionSegs.length : 0
  const maxSpeed = Math.max(0, ...segments.map((s) => s.maxSpeedKmh))
  const maxSpeedSegment = segments.find((s) => s.maxSpeedKmh === maxSpeed)
  const maxSpeedDate = maxSpeedSegment ? sessionById.get(maxSpeedSegment.sessionId)?.date : undefined
  const microcycleRows =
    activePlayerId && settings
      ? MICROCYCLE_METRICS.map((def) => ({
          def,
          result: computeMicrocycleCompletion(activePlayerId, sessions, segments, (s) => def.metric(s, settings)),
        }))
      : []

  const matchSessionIds = new Set(sessions.filter((s) => s.type === 'match').map((s) => s.id))
  const gameSegs = segments.filter((s) => s.segmentKind === 'full_session' && matchSessionIds.has(s.sessionId))
  const weeklyModelRows =
    activePlayerId && gameSegs.length > 0 ? computeWeeklyPerformanceModel(segments, gameSegs, sessions) : []

  // Alerts are inherently a per-session concept (team median, 7-day speed-exposure window ending on a
  // specific date) — this page shows this player's slice of the currently selected session's alerts,
  // the same ones surfaced on Overview/Alerts, rather than replaying alerts for every past session.
  const activePlayerIdSet = new Set(activeRosterPlayers.map((p) => p.id))
  const sessionDateById = new Map(sessions.map((s) => [s.id, s.date]))
  const recentFullSessions: DatedFullSession[] = allSegments
    .filter(
      (s) => s.segmentKind === 'full_session' && !s.isRehab && activePlayerIdSet.has(s.playerId) && sessionDateById.has(s.sessionId),
    )
    .map((seg) => ({ seg, date: sessionDateById.get(seg.sessionId)! }))
  const currentSessionFullSegs = currentSession
    ? allSegments.filter(
        (s) =>
          s.sessionId === currentSession.id &&
          s.segmentKind === 'full_session' &&
          !s.isRehab &&
          activePlayerIdSet.has(s.playerId),
      )
    : []
  const playerAlerts =
    activePlayerId && settings && currentSession && currentSessionFullSegs.length > 0
      ? computeSessionAlerts(currentSessionFullSegs, currentSessionRpe, settings, recentFullSessions, currentSession.date).filter(
          (f) => f.playerId === activePlayerId,
        )
      : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-secondary">Giocatore</span>
          <select
            value={activePlayerId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-ink"
          >
            {activeRosterPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
        {player?.position && player.position !== 'UNSPECIFIED' && (
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-medium text-ink-secondary">
            {player.position}
          </span>
        )}
        {player?.heightCm !== undefined && (
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-medium text-ink-secondary">
            {player.heightCm.toFixed(0)} cm
          </span>
        )}
        {player?.weightKg !== undefined && (
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-medium text-ink-secondary">
            {player.weightKg.toFixed(1)} kg
          </span>
        )}
      </div>

      {loadingSegments ? null : sessionCount === 0 ? (
        <EmptyState
          icon={UserCircle}
          title="Nessun dato per questo giocatore"
          description="Questo giocatore non compare in nessuna sessione importata."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Sessioni" value={String(sessionCount)} />
            <StatTile label="Distanza media" value={formatNumber(avgDistance)} unit="m" />
            <StatTile
              label="Vmax storica"
              value={formatNumber(maxSpeed, 1)}
              unit="km/h"
              accent
              hint={maxSpeedDate ? `Registrata il ${maxSpeedDate}` : undefined}
            />
            <StatTile label="Posizione" value={player?.position ?? '—'} />
          </div>

          {currentSession && (
            <div className="panel p-4">
              <p className="font-display mb-1 text-base font-medium text-ink">Alert — {currentSession.label}</p>
              <p className="mb-3 text-xs text-ink-muted">
                Deficit di velocità massima, esposizione a velocità alta negli ultimi 7 giorni e carichi anomali
                rispetto alla mediana squadra, per la sessione attualmente selezionata.
              </p>
              {playerAlerts.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-ink-secondary">
                  <ShieldCheck className="size-4 text-status-good" />
                  Nessun alert per {player?.displayName ?? 'questo giocatore'}.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {playerAlerts.map((flag, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[flag.severity]}`}>
                        {SEVERITY_LABEL[flag.severity]}
                      </span>
                      <span className="text-ink-secondary">{flag.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {microcycleRows.length > 0 && (
            <div className="panel p-4">
              <p className="font-display mb-1 text-base font-medium text-ink">Completamento microciclo attuale</p>
              <p className="mb-3 text-xs text-ink-muted">
                Carico dalle {microcycleRows[0].result.sessionsSinceLastMatch} sedute svolte dall'ultima partita a
                oggi
                {microcycleRows[0].result.validCycleCount > 0 &&
                  `, su ${microcycleRows[0].result.validCycleCount} microcicli storici validi`}
                . Ogni riga confronta il valore contro la media dello stesso dato in un microciclo tipo (Ripresa +
                Forza + Metabolico + Rifinitura).
              </p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {microcycleRows.map(({ def, result }) => (
                  <div key={def.key} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="text-ink-secondary">{def.label}</span>
                    <span className="shrink-0 tabular-nums text-ink" title={DENOMINATOR_CAPTION[result.denominatorSource]}>
                      {result.pct !== null ? `${result.pct.toFixed(0)}%` : '—'}
                      {result.lowSample && <span className="text-status-warning">*</span>}
                    </span>
                  </div>
                ))}
              </div>
              {microcycleRows.some((r) => r.result.lowSample) && (
                <p className="mt-2 text-xs text-ink-muted">
                  * poche sessioni finora in questo microciclo: percentuale poco affidabile.
                </p>
              )}
            </div>
          )}

          {weeklyModelRows.length > 0 && (
            <div className="panel p-4">
              <p className="font-display mb-1 text-base font-medium text-ink">Modello prestativo settimanale</p>
              <p className="mb-3 text-xs text-ink-muted">
                Confronta il carico cumulato negli allenamenti svolti dall'ultima partita a oggi contro un target
                teorico: 2.5x il modello gara per il volume totale, 1.5x per le distanze ad alta velocità. Stessa
                logica di Session v Game, applicata al solo {player?.displayName ?? 'giocatore'}.
              </p>
              <div className="flex flex-col gap-4">
                {weeklyModelRows.map((row) => (
                  <ComparisonBar
                    key={row.key}
                    label={row.label}
                    unit={row.unit}
                    primaryLabel="Post-gara"
                    primaryValue={row.postMatchValue}
                    referenceLabel="Target"
                    referenceValue={row.target}
                    showRatio
                  />
                ))}
              </div>
            </div>
          )}

          {fullSessionSegs.length >= 2 ? (
            <div className="panel p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{trendMetric.label} nel tempo</p>
                <label className="flex items-center gap-2 text-xs">
                  <span className="text-ink-secondary">Metrica</span>
                  <select
                    value={trendMetricKey}
                    onChange={(e) => setTrendMetricKey(e.target.value)}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-ink"
                  >
                    {trendMetrics.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {chartRows.length >= 2 ? (
                <TrendLine
                  data={chartRows.map((r) => ({ x: r.session.date, value: trendMetric.getValue(r.segment) }))}
                  valueFormatter={(v) =>
                    `${formatNumber(v, trendMetric.unit === 'km/h' ? 1 : 0)}${trendMetric.unit ? ` ${trendMetric.unit}` : ''}`
                  }
                />
              ) : (
                <p className="py-10 text-center text-xs text-ink-muted">
                  Seleziona almeno 2 sessioni nella tabella qui sotto per vedere l'andamento.
                </p>
              )}
            </div>
          ) : (
            <EmptyState
              icon={UserCircle}
              title="Trend non ancora disponibile"
              description="Servono almeno 2 sessioni per questo giocatore per mostrare l'andamento nel tempo."
            />
          )}

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Storico sessioni</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-ink-muted">Seleziona le sessioni da includere nel grafico sopra</span>
                <button
                  type="button"
                  onClick={() => setExcludedSegIds(new Set())}
                  className="font-medium text-accent hover:underline"
                >
                  Seleziona tutto
                </button>
                <button
                  type="button"
                  onClick={() => setExcludedSegIds(new Set(fullSessionSegs.map((r) => r.segment.id)))}
                  className="font-medium text-accent hover:underline"
                >
                  Deseleziona tutto
                </button>
              </div>
            </div>
            <div className="overflow-x-auto panel">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-2">
                      <span className="sr-only">Includi nel grafico</span>
                    </th>
                    <th className="px-4 py-2">Data</th>
                    <th className="px-4 py-2">Etichetta</th>
                    <th className="px-3 py-2 text-right">TD (m)</th>
                    <th className="px-3 py-2 text-right">HSR (m)</th>
                    <th className="px-3 py-2 text-right">Vmax (km/h)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...fullSessionSegs].reverse().map((r) => {
                    const included = !excludedSegIds.has(r.segment.id)
                    const rehab = r.segment.isRehab
                    const cellText = rehab ? 'text-status-critical' : 'text-ink'
                    return (
                    <tr
                      key={r.segment.id}
                      className={`border-b border-border last:border-0 ${rehab ? 'bg-status-critical/10' : ''} ${included ? '' : 'opacity-40'}`}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => toggleSegSelection(r.segment.id)}
                          aria-label={`Includi la sessione del ${r.session.date} nel grafico`}
                          className="size-4 rounded border-border accent-[var(--color-accent)]"
                        />
                      </td>
                      <td className={`px-4 py-2 tabular-nums ${cellText}`}>{r.session.date}</td>
                      <td className={`px-4 py-2 ${rehab ? 'text-status-critical' : 'text-ink-secondary'}`}>
                        {sessionHistoryLabel(r.session)}
                        {rehab && (
                          <span className="ml-1.5 rounded-full bg-status-critical/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-status-critical">
                            Rehab
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${cellText}`}>
                        {r.segment.totalDistanceM.toFixed(0)}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${cellText}`}>{r.segment.hsrM.toFixed(0)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${cellText}`}>
                        {r.segment.maxSpeedKmh.toFixed(1)}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {fullSessionSegs.some((r) => r.segment.isRehab) && (
              <p className="mt-2 text-xs text-status-critical">
                Le righe in rosso sono sessioni di rehab (giocatore infortunato): contano per lo storico personale
                di {player?.displayName ?? 'questo giocatore'}, ma sono escluse da medie, mediane e classifiche di
                squadra altrove nell'app.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
