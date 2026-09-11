import { Dumbbell } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '../components/ui/EmptyState'
import { HeatmapTable, type HeatmapColumn, type HeatmapGroup } from '../components/ui/HeatmapTable'
import {
  accHighCount,
  accModerateCount,
  decHighCount,
  decModerateCount,
  distanceAbove14_4,
  distanceAbove19_8,
  distanceAbove25_2,
  mechanicalWork,
  mechanicalWorkPerMin,
  sprintCount,
} from '../lib/metrics/metricsCatalog'
import { useCurrentSession } from '../state/CurrentSessionContext'
import { usePlayersQuery, useSegmentsBySessionQuery, useSettingsQuery } from '../state/queries'
import type { DrillSegment, Player, Position } from '../types/domain'

const POSITION_ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD', 'UNSPECIFIED']
const POSITION_LABEL: Record<Position, string> = {
  GK: 'Portieri',
  DEF: 'Difensori',
  MID: 'Centrocampisti',
  FWD: 'Attaccanti',
  UNSPECIFIED: 'Non assegnati',
}

export function DrillsPage() {
  const { currentSession } = useCurrentSession()
  const { data: segments = [], isLoading: loadingSegments } = useSegmentsBySessionQuery(currentSession?.id)
  const { data: players = [] } = usePlayersQuery()
  const { data: settings } = useSettingsQuery()
  const [selectedDrill, setSelectedDrill] = useState<string | null>(null)

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])

  const drillTitles = useMemo(() => [...new Set(segments.map((s) => s.drillTitle))], [segments])

  const activeDrill = selectedDrill ?? drillTitles[0] ?? null

  if (!currentSession || loadingSegments || !settings) return null

  if (segments.length === 0) {
    return (
      <EmptyState
        icon={Dumbbell}
        title="Nessun dato per questa sessione"
        description="Importa un CSV per vedere la tabella per drill."
      />
    )
  }

  const rowsForDrill = segments.filter((s) => s.drillTitle === activeDrill)

  const columns: HeatmapColumn<DrillSegment>[] = [
    { key: 'duration', label: 'Durata', unit: 'min', getValue: (s) => s.durationSec / 60, format: (v) => v.toFixed(0) },
    { key: 'td', label: 'TD', unit: 'm', getValue: (s) => s.totalDistanceM, format: (v) => v.toFixed(0) },
    { key: 'd14', label: 'D>14.4', unit: 'm', getValue: distanceAbove14_4, format: (v) => v.toFixed(0) },
    { key: 'd19', label: 'D>19.8', unit: 'm', getValue: distanceAbove19_8, format: (v) => v.toFixed(0) },
    { key: 'd25', label: 'D>25.2', unit: 'm', getValue: distanceAbove25_2, format: (v) => v.toFixed(0) },
    { key: 'vmax', label: 'Vmax', unit: 'km/h', getValue: (s) => s.maxSpeedKmh, format: (v) => v.toFixed(1) },
    { key: 'sprints', label: 'Sprint', unit: '#', getValue: (s) => sprintCount(s, settings), format: (v) => v.toFixed(0) },
    { key: 'accMod', label: 'Acc mod.', unit: '#', getValue: (s) => accModerateCount(s, settings), format: (v) => v.toFixed(0) },
    { key: 'accHigh', label: 'Acc alta', unit: '#', getValue: (s) => accHighCount(s, settings), format: (v) => v.toFixed(0) },
    { key: 'decMod', label: 'Dec mod.', unit: '#', getValue: (s) => decModerateCount(s, settings), format: (v) => v.toFixed(0) },
    { key: 'decHigh', label: 'Dec alta', unit: '#', getValue: (s) => decHighCount(s, settings), format: (v) => v.toFixed(0) },
    { key: 'mechw', label: 'MechW', unit: '#', getValue: (s) => mechanicalWork(s, settings), format: (v) => v.toFixed(0) },
    {
      key: 'mechwmin',
      label: 'MechW/min',
      getValue: (s) => mechanicalWorkPerMin(s, settings),
      format: (v) => v.toFixed(2),
    },
    { key: 'pctmax', label: '% Vmax', unit: '%', getValue: (s) => s.pctMaxSpeed, format: (v) => v.toFixed(0) },
  ]

  const groupsByPosition = new Map<Position, DrillSegment[]>()
  for (const seg of rowsForDrill) {
    const pos = playerById.get(seg.playerId)?.position ?? 'UNSPECIFIED'
    const list = groupsByPosition.get(pos) ?? []
    list.push(seg)
    groupsByPosition.set(pos, list)
  }

  const groups: HeatmapGroup<DrillSegment>[] = POSITION_ORDER.filter((pos) => groupsByPosition.has(pos)).map((pos) => ({
    label: POSITION_LABEL[pos],
    rows: groupsByPosition.get(pos)!.sort((a, b) => getName(playerById, a).localeCompare(getName(playerById, b))),
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {drillTitles.map((title) => (
          <button
            key={title}
            type="button"
            onClick={() => setSelectedDrill(title)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              title === activeDrill ? 'bg-accent text-accent-ink' : 'bg-ink/5 text-ink-secondary hover:bg-ink/10'
            }`}
          >
            {title}
          </button>
        ))}
      </div>

      <HeatmapTable
        columns={columns}
        groups={groups}
        getRowKey={(s) => s.id}
        getRowLabel={(s) => getName(playerById, s)}
      />
    </div>
  )
}

function getName(playerById: Map<string, Player>, segment: DrillSegment): string {
  return playerById.get(segment.playerId)?.displayName ?? segment.playerId
}
