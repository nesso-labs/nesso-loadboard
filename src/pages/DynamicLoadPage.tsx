import { BarChart3 } from 'lucide-react'
import { MetricTrendPanel } from '../components/charts/MetricTrendPanel'
import { MicrocycleBarChart, type MicrocycleBarChartGroup } from '../components/charts/MicrocycleBarChart'
import { EmptyState } from '../components/ui/EmptyState'
import { distanceAbove19_8, distanceAbove25_2, MICROCYCLE_METRICS } from '../lib/metrics/metricsCatalog'
import { computeMicrocycleCompletion } from '../lib/metrics/microcycle'
import { rollingAverageByDateWindow } from '../lib/metrics/timeSeries'
import { mean } from '../lib/utils'
import { useAllRpeQuery, useAllSegmentsQuery, usePlayersQuery, useSessionsQuery, useSettingsQuery } from '../state/queries'
import type { Player, Position } from '../types/domain'

const POSITION_ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD', 'UNSPECIFIED']
const POSITION_LABEL: Record<Position, string> = {
  GK: 'Portieri',
  DEF: 'Difensori',
  MID: 'Centrocampisti',
  FWD: 'Attaccanti',
  UNSPECIFIED: 'Non assegnati',
}

interface MicrocycleRow {
  player: Player
  sessionsSinceLastMatch: number
  metrics: { key: string; label: string; pct: number | null; lowSample: boolean }[]
}

export function DynamicLoadPage() {
  const { data: sessions = [], isLoading: loadingSessions } = useSessionsQuery()
  const { data: rawSegments = [], isLoading: loadingSegments } = useAllSegmentsQuery()
  const { data: rawRpe = [] } = useAllRpeQuery()
  const { data: players = [] } = usePlayersQuery()
  const { data: settings } = useSettingsQuery()

  if (loadingSessions || loadingSegments || !settings) return null

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Nessuna sessione ancora importata"
        description="Importa almeno una sessione per iniziare a vedere i trend di carico."
      />
    )
  }

  // Deactivated players never show up again, anywhere on this page, until reactivated in Roster & Positions.
  const activePlayerIds = new Set(players.filter((p) => p.active).map((p) => p.id))
  const segments = rawSegments.filter((s) => activePlayerIds.has(s.playerId))
  const rpe = rawRpe.filter((r) => activePlayerIds.has(r.playerId))

  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const fullSessionByDate = sorted.map((session) => {
    const segs = segments.filter((s) => s.sessionId === session.id && s.segmentKind === 'full_session')
    const sessionRpe = rpe.filter((r) => r.sessionId === session.id)
    return { session, segs, sessionRpe }
  })

  const buildPoints = (getValue: (s: (typeof segments)[number]) => number) =>
    fullSessionByDate.map(({ session, segs }) => ({
      date: session.date,
      label: session.date.slice(5),
      value: mean(segs.map(getValue)),
      type: session.type,
    }))

  const sRpePoints = fullSessionByDate.map(({ session, sessionRpe }) => ({
    date: session.date,
    label: session.date.slice(5),
    value: sessionRpe.length > 0 ? mean(sessionRpe.map((r) => r.sRpe)) : 0,
    type: session.type,
  }))

  const panels = [
    { title: 'Distanza totale', unit: 'm', points: buildPoints((s) => s.totalDistanceM) },
    { title: 'Distanza > 19.8 km/h', unit: 'm', points: buildPoints(distanceAbove19_8) },
    { title: 'Distanza > 25.2 km/h', unit: 'm', points: buildPoints(distanceAbove25_2) },
    { title: 'sRPE', unit: '', points: sRpePoints },
  ]

  const singleSession = sessions.length === 1

  const trackedMicrocycleMetrics = MICROCYCLE_METRICS.filter((m) => m.key !== 'duration')
  const shortMetricLabel: Record<string, string> = {
    totalDistance: 'Dist. tot.',
    hsr: 'HSR (>19.8)',
    sprintDistance: 'Dist. sprint',
    sprintCount: 'N. sprint',
    mechanicalWork: 'MechW',
    accHigh: 'Acc. alte',
    decHigh: 'Dec. alte',
  }

  const activePlayers = players.filter((p) => p.active)
  const microcycleRows: MicrocycleRow[] = activePlayers.map((player) => {
    const playerSegments = segments.filter((s) => s.playerId === player.id)
    let sessionsSinceLastMatch = 0
    const metrics = trackedMicrocycleMetrics.map((def, i) => {
      const result = computeMicrocycleCompletion(player.id, sessions, playerSegments, (s) => def.metric(s, settings))
      if (i === 0) sessionsSinceLastMatch = result.sessionsSinceLastMatch
      return { key: def.key, label: shortMetricLabel[def.key] ?? def.label, pct: result.pct, lowSample: result.lowSample }
    })
    return { player, sessionsSinceLastMatch, metrics }
  })

  const microcycleGroupsByPosition = new Map<Position, MicrocycleRow[]>()
  for (const row of microcycleRows) {
    const list = microcycleGroupsByPosition.get(row.player.position) ?? []
    list.push(row)
    microcycleGroupsByPosition.set(row.player.position, list)
  }
  const microcycleGroups: MicrocycleBarChartGroup[] = POSITION_ORDER.filter((pos) =>
    microcycleGroupsByPosition.has(pos),
  ).map((pos) => ({
    label: POSITION_LABEL[pos],
    players: microcycleGroupsByPosition
      .get(pos)!
      .sort((a, b) => a.player.displayName.localeCompare(b.player.displayName)),
  }))

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-secondary">
        Media squadra per sessione ({sorted.length} {sorted.length === 1 ? 'sessione' : 'sessioni'} in archivio) — linea:
        media mobile su finestra di {settings.rollingWindowDays} giorni.
      </p>

      {singleSession && (
        <div className="rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-ink-secondary">
          Con una sola sessione la media mobile coincide con il singolo valore — importa più sessioni nel tempo per
          vedere un vero trend.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {panels.map((panel) => {
          const rolling = rollingAverageByDateWindow(panel.points, settings.rollingWindowDays)
          const last = panel.points[panel.points.length - 1]
          return (
            <MetricTrendPanel
              key={panel.title}
              title={panel.title}
              unit={panel.unit}
              points={panel.points}
              rolling={rolling}
              latestValue={last?.value}
            />
          )
        })}
      </div>

      {microcycleRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-secondary">
            Per giocatore: allenamenti svolti dall'ultima partita a oggi, e ogni metrica di carico come % rispetto a
            un microciclo tipo storico (Ripresa + Forza + Metabolico + Rifinitura).
          </p>
          <MicrocycleBarChart groups={microcycleGroups} />
        </div>
      )}
    </div>
  )
}

