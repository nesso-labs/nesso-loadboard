import { Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui/EmptyState'
import { StatTile } from '../components/ui/StatTile'
import { useCurrentSession } from '../state/CurrentSessionContext'
import { useSegmentsBySessionQuery } from '../state/queries'
import { formatNumber } from '../lib/utils'

export function OverviewPage() {
  const { sessions, currentSession, isLoading } = useCurrentSession()
  const { data: segments = [] } = useSegmentsBySessionQuery(currentSession?.id)

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-ink-secondary">
          {currentSession?.date} · {currentSession?.label} · {currentSession?.type === 'match' ? 'Partita' : 'Allenamento'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Giocatori" value={String(playerCount)} />
        <StatTile label="Distanza media" value={formatNumber(avgDistance)} unit="m" />
        <StatTile label="HSR media" value={formatNumber(avgHsr)} unit="m" />
        <StatTile label="Vmax sessione" value={formatNumber(maxSpeed, 1)} unit="km/h" accent />
      </div>

      <EmptyState
        icon={Upload}
        title="Alert e classifiche in arrivo"
        description="Questa pagina si arricchirà con gli alert di carico e i link rapidi man mano che costruiamo le altre viste."
      />
    </div>
  )
}
