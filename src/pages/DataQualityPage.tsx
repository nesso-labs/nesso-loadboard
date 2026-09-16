import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import { EmptyState } from '../components/ui/EmptyState'
import { putPlayer } from '../lib/db/repo'
import { evaluatePlayerPb, type PbStatus } from '../lib/metrics/pb'
import { useCurrentSession } from '../state/CurrentSessionContext'
import { queryKeys, usePlayersQuery, useSegmentsBySessionQuery } from '../state/queries'
import type { Player } from '../types/domain'

const PB_STATUS_STYLE: Record<PbStatus, string> = {
  ok: 'bg-status-good/15 text-status-good',
  new_record: 'bg-status-warning/20 text-ink',
  implausible: 'bg-status-critical/15 text-status-critical',
  unconfirmed: 'bg-status-warning/20 text-ink',
}

const PB_STATUS_LABEL: Record<PbStatus, string> = {
  ok: 'Confermato',
  new_record: 'Nuovo record — da confermare',
  implausible: 'Implausibile — da verificare',
  unconfirmed: 'Da confermare',
}

export function DataQualityPage() {
  const { currentSession } = useCurrentSession()
  const { data: segments = [], isLoading: loadingSegments } = useSegmentsBySessionQuery(currentSession?.id)
  const { data: players = [] } = usePlayersQuery()
  const queryClient = useQueryClient()

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const activePlayerIds = useMemo(() => new Set(players.filter((p) => p.active).map((p) => p.id)), [players])

  const confirmPb = useMutation({
    mutationFn: (player: Player) => putPlayer({ ...player, pbConfirmed: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.players }),
  })

  if (!currentSession || loadingSegments) return null

  const reassignments = currentSession.reconciliation ?? []
  // Match-day exports never carry a "Full Session" row by design (only 1st/2nd
  // Half) — that's the normal shape of this export, not a data-quality issue, so
  // it's not flagged here. Only a training session missing one is unusual.
  const synthesized = segments.filter(
    (s) => s.isSynthesizedFullSession && currentSession.type !== 'match' && activePlayerIds.has(s.playerId),
  )
  const playersInSession = new Set(segments.map((s) => s.playerId))

  const pbFlags = players
    .filter((p) => p.active && playersInSession.has(p.id))
    .map((p) => {
      const sessionSegs = segments.filter((s) => s.playerId === p.id)
      const sessionMax = Math.max(0, ...sessionSegs.map((s) => s.maxSpeedKmh))
      return { player: p, evaluation: evaluatePlayerPb(p, sessionMax) }
    })
    .filter((f) => f.evaluation.status !== 'ok')

  const nothingToShow = reassignments.length === 0 && synthesized.length === 0 && pbFlags.length === 0

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border border-border bg-surface p-3 text-sm text-ink-secondary">
        Questa pagina non corregge mai un dato in silenzio: ogni riga riassegnata o stimata resta visibile qui con il
        motivo. Le voci "da confermare" non bloccano la dashboard — sospendono solo le letture che dipendono da un
        dato non ancora validato (es. % della velocità massima personale).
      </div>

      {nothingToShow ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nessun problema rilevato per questa sessione"
          description="Nessuna riga riassegnata, nessuna sessione stimata, nessun riferimento di velocità da confermare."
        />
      ) : (
        <>
          {reassignments.length > 0 && (
            <section className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-ink">
                Righe riassegnate <span className="font-normal text-ink-muted">({reassignments.length})</span>
              </p>
              <div className="overflow-x-auto panel">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2">Riga</th>
                      <th className="px-4 py-2">Drill</th>
                      <th className="px-4 py-2">Da</th>
                      <th className="px-4 py-2">A</th>
                      <th className="px-4 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reassignments.map((a, i) => (
                      <tr key={i} className="border-b border-border align-top last:border-0">
                        <td className="px-4 py-2 tabular-nums text-ink-secondary">{a.rowIndex}</td>
                        <td className="px-4 py-2 text-ink-secondary">{a.drillTitle}</td>
                        <td className="px-4 py-2 font-medium text-ink">{a.fromPlayerName}</td>
                        <td className="px-4 py-2 font-medium text-ink">{a.toPlayerName}</td>
                        <td className="px-4 py-2 text-ink-secondary">{a.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {synthesized.length > 0 && (
            <section className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-ink">
                Completezza dell'export <span className="font-normal text-ink-muted">({synthesized.length})</span>
              </p>
              <div className="flex flex-col gap-2">
                {synthesized.map((s) => (
                  <div key={s.id} className="flex items-start gap-2 rounded-md border border-status-warning/30 bg-status-warning/10 p-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-warning" />
                    <div>
                      <p className="font-medium text-ink">
                        {playerById.get(s.playerId)?.displayName ?? s.playerId}: nessuna riga "Full Session" nel file
                      </p>
                      <p className="text-ink-secondary">
                        Sessione totale calcolata sommando gli altri drill di questo giocatore (es. 1°/2° tempo, o un
                        programma individuale come Rehab).
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pbFlags.length > 0 && (
            <section className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-ink">
                Riferimenti di velocità <span className="font-normal text-ink-muted">({pbFlags.length} da confermare)</span>
              </p>
              <div className="flex flex-col gap-2">
                {pbFlags.map(({ player, evaluation }) => (
                  <div key={player.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PB_STATUS_STYLE[evaluation.status]}`}>
                        {PB_STATUS_LABEL[evaluation.status]}
                      </span>
                      <div>
                        <p className="font-medium text-ink">{player.displayName}</p>
                        <p className="text-ink-secondary">{evaluation.message}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => confirmPb.mutate(player)}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-ink-secondary hover:bg-ink/5"
                    >
                      <Check className="size-3.5" /> Conferma
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
