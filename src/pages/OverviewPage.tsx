import { ArrowRight, ShieldCheck, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui/EmptyState'
import { StatTile } from '../components/ui/StatTile'
import { computeSessionAlerts, type AlertSeverity } from '../lib/metrics/alerts'
import { computeMicrocycleCompletion } from '../lib/metrics/microcycle'
import { formatNumber } from '../lib/utils'
import { useCurrentSession } from '../state/CurrentSessionContext'
import {
  useAllSegmentsQuery,
  usePlayersQuery,
  useRpeBySessionQuery,
  useSegmentsBySessionQuery,
  useSettingsQuery,
} from '../state/queries'
import { TRAINING_TYPE_LABEL } from '../types/domain'

const SEVERITY_STYLE: Record<AlertSeverity, string> = {
  critical: 'bg-status-critical/15 text-status-critical',
  serious: 'bg-status-serious/20 text-status-serious',
  warning: 'bg-status-warning/20 text-ink',
}

export function OverviewPage() {
  const { sessions, currentSession, isLoading } = useCurrentSession()
  const { data: segments = [] } = useSegmentsBySessionQuery(currentSession?.id)
  const { data: rpe = [] } = useRpeBySessionQuery(currentSession?.id)
  const { data: settings } = useSettingsQuery()
  const { data: players = [] } = usePlayersQuery()
  const { data: allSegments = [] } = useAllSegmentsQuery()

  if (isLoading) return null

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={Upload}
        title="Nessuna sessione ancora importata"
        description="Importa il primo export CSV per vedere la dashboard di questa sessione — distanze, HSR, mechanical work e altro."
        action={
          <Link
            to="/sessions"
            className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            Importa una sessione
          </Link>
        }
      />
    )
  }

  const fullSessionRows = segments.filter((s) => s.segmentKind === 'full_session')
  const playerCount = new Set(segments.map((s) => s.playerId)).size
  const totalDistance = fullSessionRows.reduce((sum, s) => sum + s.totalDistanceM, 0)
  const avgDistance = fullSessionRows.length > 0 ? totalDistance / fullSessionRows.length : 0
  const totalHsr = fullSessionRows.reduce((sum, s) => sum + s.hsrM, 0)
  const avgHsr = fullSessionRows.length > 0 ? totalHsr / fullSessionRows.length : 0
  const maxSpeed = Math.max(0, ...segments.map((s) => s.maxSpeedKmh))
  const playerById = new Map(players.map((p) => [p.id, p]))
  const flags = settings ? computeSessionAlerts(fullSessionRows, rpe, settings) : []

  const activePlayers = players.filter((p) => p.active)
  const microcycleByPlayer = activePlayers
    .map((p) => ({
      player: p,
      result: computeMicrocycleCompletion(
        p.id,
        sessions,
        allSegments.filter((s) => s.playerId === p.id),
        (s) => s.totalDistanceM,
      ),
    }))
    .filter((r) => r.result.pct !== null)
    .sort((a, b) => (a.result.pct ?? 0) - (b.result.pct ?? 0))
  const teamAvgMicrocyclePct =
    microcycleByPlayer.length > 0
      ? microcycleByPlayer.reduce((sum, r) => sum + (r.result.pct ?? 0), 0) / microcycleByPlayer.length
      : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-medium text-ink">{currentSession?.label}</h2>
        <span className="rounded-full bg-ink/8 px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
          {currentSession?.date}
        </span>
        <span className="rounded-full bg-ink/8 px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
          {currentSession?.type === 'match' ? 'Partita' : 'Allenamento'}
        </span>
        {currentSession?.type === 'training' && currentSession.trainingType && (
          <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
            {TRAINING_TYPE_LABEL[currentSession.trainingType]}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Giocatori" value={String(playerCount)} />
        <StatTile label="Distanza media" value={formatNumber(avgDistance)} unit="m" />
        <StatTile label="HSR media" value={formatNumber(avgHsr)} unit="m" />
        <StatTile label="Vmax sessione" value={formatNumber(maxSpeed, 1)} unit="km/h" accent />
      </div>

      <div className="panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-base font-medium text-ink">Alert di questa sessione</p>
          <Link to="/alerts" className="flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80">
            Vedi tutti <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {flags.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-ink-secondary">
            <ShieldCheck className="size-4 text-status-good" />
            Nessun alert per questa sessione.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {flags.slice(0, 5).map((flag, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[flag.severity]}`}>
                  {playerById.get(flag.playerId)?.displayName ?? flag.playerId}
                </span>
                <span className="truncate text-ink-secondary">{flag.message}</span>
              </li>
            ))}
            {flags.length > 5 && <li className="text-xs text-ink-muted">+ altri {flags.length - 5}</li>}
          </ul>
        )}
      </div>

      {microcycleByPlayer.length > 0 && (
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-base font-medium text-ink">Completamento microciclo — squadra</p>
            <Link to="/players" className="flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80">
              Vedi per giocatore <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <p className="mb-3 text-sm text-ink-secondary">
            Media squadra:{' '}
            <span className="font-display text-lg font-semibold tabular-nums text-ink">
              {teamAvgMicrocyclePct?.toFixed(0)}%
            </span>{' '}
            del carico di una settimana tipo storica, da giocatore attivo con dati sufficienti.
          </p>
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {microcycleByPlayer.slice(0, 12).map(({ player, result }) => (
              <div key={player.id} className="flex items-center justify-between gap-2 py-0.5 text-sm">
                <span className="truncate text-ink-secondary">{player.displayName}</span>
                <span className="shrink-0 tabular-nums text-ink">
                  {result.pct?.toFixed(0)}%{result.lowSample && <span className="text-status-warning">*</span>}
                </span>
              </div>
            ))}
          </div>
          {microcycleByPlayer.length > 12 && (
            <p className="mt-2 text-xs text-ink-muted">+ altri {microcycleByPlayer.length - 12} giocatori</p>
          )}
        </div>
      )}
    </div>
  )
}
