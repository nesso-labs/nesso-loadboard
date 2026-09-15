import { UserCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TrendLine } from '../components/charts/TrendLine'
import { EmptyState } from '../components/ui/EmptyState'
import { StatTile } from '../components/ui/StatTile'
import { MICROCYCLE_METRICS } from '../lib/metrics/metricsCatalog'
import { computeMicrocycleCompletion } from '../lib/metrics/microcycle'
import { formatNumber } from '../lib/utils'
import { usePlayersQuery, useSegmentsByPlayerQuery, useSessionsQuery, useSettingsQuery } from '../state/queries'

const DENOMINATOR_CAPTION: Record<string, string> = {
  'valid-cycles': 'vs media dei microcicli storici completi (Ripresa+Forza+Metabolico+Rifinitura)',
  'per-type-fallback': 'vs media per tipologia — nessun microciclo storico completo ancora disponibile',
  'insufficient-data': 'dati storici insufficienti per un confronto',
}

export function PlayerProfilePage() {
  const { data: players = [], isLoading: loadingPlayers } = usePlayersQuery()
  const { data: sessions = [] } = useSessionsQuery()
  const { data: settings } = useSettingsQuery()
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

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

  const sessionCount = new Set(segments.map((s) => s.sessionId)).size
  const avgDistance =
    fullSessionSegs.length > 0 ? fullSessionSegs.reduce((sum, r) => sum + r.segment.totalDistanceM, 0) / fullSessionSegs.length : 0
  const maxSpeed = Math.max(0, ...segments.map((s) => s.maxSpeedKmh))
  const microcycleRows =
    activePlayerId && settings
      ? MICROCYCLE_METRICS.map((def) => ({
          def,
          result: computeMicrocycleCompletion(activePlayerId, sessions, segments, (s) => def.metric(s, settings)),
        }))
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
            <StatTile label="Vmax storica" value={formatNumber(maxSpeed, 1)} unit="km/h" accent />
            <StatTile label="Posizione" value={player?.position ?? '—'} />
          </div>

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

          {fullSessionSegs.length >= 2 ? (
            <div className="panel p-4">
              <p className="mb-2 text-sm font-semibold text-ink">Distanza totale nel tempo</p>
              <TrendLine
                data={fullSessionSegs.map((r) => ({ x: r.session.date, value: r.segment.totalDistanceM }))}
                valueFormatter={(v) => `${formatNumber(v)} m`}
              />
            </div>
          ) : (
            <EmptyState
              icon={UserCircle}
              title="Trend non ancora disponibile"
              description="Servono almeno 2 sessioni per questo giocatore per mostrare l'andamento nel tempo."
            />
          )}

          <div>
            <p className="mb-3 text-sm font-semibold text-ink">Storico sessioni</p>
            <div className="overflow-x-auto panel">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-2">Data</th>
                    <th className="px-4 py-2">Etichetta</th>
                    <th className="px-3 py-2 text-right">TD (m)</th>
                    <th className="px-3 py-2 text-right">HSR (m)</th>
                    <th className="px-3 py-2 text-right">Vmax (km/h)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...fullSessionSegs].reverse().map((r) => (
                    <tr key={r.segment.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 tabular-nums text-ink">{r.session.date}</td>
                      <td className="px-4 py-2 text-ink-secondary">{r.session.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">
                        {r.segment.totalDistanceM.toFixed(0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">{r.segment.hsrM.toFixed(0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">
                        {r.segment.maxSpeedKmh.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
