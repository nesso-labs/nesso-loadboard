import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Users } from 'lucide-react'
import { putPlayer } from '../lib/db/repo'
import { evaluatePlayerPb } from '../lib/metrics/pb'
import type { Player, Position } from '../types/domain'
import { EmptyState } from '../components/ui/EmptyState'
import { queryKeys, usePlayersQuery } from '../state/queries'

const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD', 'UNSPECIFIED']

const POSITION_LABEL: Record<Position, string> = {
  GK: 'Portiere',
  DEF: 'Difensore',
  MID: 'Centrocampista',
  FWD: 'Attaccante',
  UNSPECIFIED: 'Non assegnato',
}

export function RosterPage() {
  const { data: players = [], isLoading } = usePlayersQuery()
  const queryClient = useQueryClient()

  const updatePlayer = useMutation({
    mutationFn: (player: Player) => putPlayer(player),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.players }),
  })

  if (isLoading) return null

  if (players.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nessun giocatore ancora"
        description="I giocatori vengono creati automaticamente al primo import di un CSV — importa una sessione per iniziare."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-secondary">
        {players.length} giocatori. La posizione alimenta i raggruppamenti nelle pagine Drills e Session v Session.
      </p>

      <div className="overflow-x-auto panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-2">Giocatore</th>
              <th className="px-4 py-2">Posizione</th>
              <th className="px-4 py-2">Vmax personale</th>
              <th className="px-4 py-2">Attivo</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium text-ink">{player.displayName}</td>
                <td className="px-4 py-2">
                  <select
                    value={player.position}
                    onChange={(e) =>
                      updatePlayer.mutate({
                        ...player,
                        position: e.target.value as Position,
                        updatedAt: new Date().toISOString(),
                      })
                    }
                    className="rounded-md border border-border bg-page px-2 py-1 text-sm text-ink"
                  >
                    {POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {POSITION_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  {player.personalMaxSpeedKmh === undefined ? (
                    <span className="text-xs text-ink-muted">—</span>
                  ) : (
                    (() => {
                      const evaluation = evaluatePlayerPb(player, player.personalMaxSpeedKmh)
                      return (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="tabular-nums text-ink">{player.personalMaxSpeedKmh.toFixed(2)} km/h</span>
                          {evaluation.status === 'ok' ? (
                            <span className="rounded-full bg-status-good/15 px-2 py-0.5 font-medium text-status-good">
                              Confermato
                            </span>
                          ) : (
                            <button
                              type="button"
                              title={evaluation.message}
                              onClick={() => updatePlayer.mutate({ ...player, pbConfirmed: true })}
                              className="flex items-center gap-1 rounded-full bg-status-warning/20 px-2 py-0.5 font-medium text-ink hover:opacity-80"
                            >
                              <Check className="size-3" /> Conferma
                            </button>
                          )}
                        </div>
                      )
                    })()
                  )}
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={player.active}
                    onChange={(e) =>
                      updatePlayer.mutate({
                        ...player,
                        active: e.target.checked,
                        updatedAt: new Date().toISOString(),
                      })
                    }
                    className="size-4 accent-accent"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
