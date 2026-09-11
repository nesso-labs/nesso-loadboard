import { UserCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TrendLine } from '../components/charts/TrendLine'
import { EmptyState } from '../components/ui/EmptyState'
import { StatTile } from '../components/ui/StatTile'
import { formatNumber } from '../lib/utils'
import { usePlayersQuery, useSegmentsByPlayerQuery, useSessionsQuery } from '../state/queries'

export function PlayerProfilePage() {
  const { data: players = [], isLoading: loadingPlayers } = usePlayersQuery()
  const { data: sessions = [] } = useSessionsQuery()
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  const activePlayerId = selectedId ?? players[0]?.id
  const { data: segments = [], isLoading: loadingSegments } = useSegmentsByPlayerQuery(activePlayerId)

  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions])
  const player = players.find((p) => p.id === activePlayerId)

  if (loadingPlayers) return null

  if (players.length === 0) {
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
            {players.map((p) => (
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

          {fullSessionSegs.length >= 2 ? (
            <div className="rounded-lg border border-border bg-surface p-4">
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
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
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
