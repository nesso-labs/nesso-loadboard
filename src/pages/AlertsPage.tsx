import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import { EmptyState } from '../components/ui/EmptyState'
import { computeSessionAlerts, type AlertSeverity, type DatedFullSession } from '../lib/metrics/alerts'
import { useCurrentSession } from '../state/CurrentSessionContext'
import {
  useAllSegmentsQuery,
  usePlayersQuery,
  useRpeBySessionQuery,
  useSegmentsBySessionQuery,
  useSettingsQuery,
} from '../state/queries'

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

export function AlertsPage() {
  const { currentSession, sessions } = useCurrentSession()
  const { data: segments = [], isLoading: loadingSegments } = useSegmentsBySessionQuery(currentSession?.id)
  const { data: allSegments = [] } = useAllSegmentsQuery()
  const { data: rpe = [] } = useRpeBySessionQuery(currentSession?.id)
  const { data: settings } = useSettingsQuery()
  const { data: players = [] } = usePlayersQuery()

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const activePlayerIds = useMemo(() => new Set(players.filter((p) => p.active).map((p) => p.id)), [players])

  if (!currentSession || loadingSegments || !settings) return null

  const fullSessionSegs = segments.filter(
    (s) => s.segmentKind === 'full_session' && !s.isRehab && activePlayerIds.has(s.playerId),
  )

  if (fullSessionSegs.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Nessun dato per questa sessione"
        description="Importa un CSV con almeno una riga 'Full Session' per calcolare gli alert."
      />
    )
  }

  const sessionDateById = new Map(sessions.map((s) => [s.id, s.date]))
  const recentFullSessions: DatedFullSession[] = allSegments
    .filter(
      (s) => s.segmentKind === 'full_session' && !s.isRehab && activePlayerIds.has(s.playerId) && sessionDateById.has(s.sessionId),
    )
    .map((seg) => ({ seg, date: sessionDateById.get(seg.sessionId)! }))

  const flags = computeSessionAlerts(fullSessionSegs, rpe, settings, recentFullSessions, currentSession.date)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-secondary">
        Alert relativi a questa sessione: deficit di velocità massima (vs il proprio storico), esposizione a
        velocità alta negli ultimi 7 giorni, e carichi anomali rispetto alla mediana squadra di oggi. Le regole si
        affineranno con più storico disponibile.
      </p>

      {flags.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nessun alert per questa sessione"
          description="Nessun giocatore supera le soglie configurate in Settings."
        />
      ) : (
        <div className="overflow-x-auto panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2">Severità</th>
                <th className="px-4 py-2">Giocatore</th>
                <th className="px-4 py-2">Dettaglio</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[flag.severity]}`}>
                      {SEVERITY_LABEL[flag.severity]}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-medium text-ink">
                    {playerById.get(flag.playerId)?.displayName ?? flag.playerId}
                  </td>
                  <td className="px-4 py-2 text-ink-secondary">{flag.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
