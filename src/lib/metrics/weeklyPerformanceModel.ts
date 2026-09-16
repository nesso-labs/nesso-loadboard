import type { DrillSegment, Session } from '../../types/domain'
import { mean } from '../utils'
import { distanceAbove19_8, distanceAbove25_2 } from './metricsCatalog'
import { currentMicrocycleSessions } from './microcycle'
import { performanceModelAverage } from './performanceModel'

export interface PerformanceModelMetricSpec {
  key: string
  label: string
  unit: string
  volume: (s: DrillSegment) => number
}

/** The 3 distance metrics behind every game-performance-model comparison — Session v Game's three charts and the Player Profile's single-player weekly model. */
export const PERFORMANCE_MODEL_METRICS: PerformanceModelMetricSpec[] = [
  { key: 'td', label: 'Distanza totale', unit: 'm', volume: (s) => s.totalDistanceM },
  { key: 'd198', label: 'Distanza > 19.8 km/h', unit: 'm', volume: distanceAbove19_8 },
  { key: 'd252', label: 'Distanza > 25.2 km/h', unit: 'm', volume: distanceAbove25_2 },
]

/** Power-law taper for the 90'-normalization of a match appearance — steeper for high-speed metrics. */
export const PERFORMANCE_MODEL_ALPHA: Record<string, number> = { td: 0.075, d198: 0.12, d252: 0.12 }

/** Post-match training target, as a multiple of the historical performance model. */
export const WEEKLY_TARGET_MULTIPLIER: Record<string, number> = { td: 2.5, d198: 1.5, d252: 1.5 }

export interface WeeklyModelRow {
  key: string
  label: string
  unit: string
  postMatchValue: number
  target: number
}

/**
 * "Modello prestativo settimanale" for one player: cumulative load in the
 * training sessions since their last match, against a target multiple of
 * their historical game performance model (see performanceModel.ts).
 * `playerFullSegs` is every full_session row for the player across their
 * whole history (any session type); `playerGameSegs` just the match ones.
 * Single-player only — Session v Game's team-average version needs to mean
 * per-player sums first, so it keeps its own aggregation.
 */
export function computeWeeklyPerformanceModel(
  playerFullSegs: DrillSegment[],
  playerGameSegs: DrillSegment[],
  sessions: Session[],
): WeeklyModelRow[] {
  const microcycleSessionIds = new Set(currentMicrocycleSessions(sessions).map((s) => s.id))
  const postMatchFullSegs = playerFullSegs.filter(
    (s) => s.segmentKind === 'full_session' && microcycleSessionIds.has(s.sessionId),
  )

  return PERFORMANCE_MODEL_METRICS.map((m) => {
    const postMatchValue = postMatchFullSegs.reduce((sum, s) => sum + m.volume(s), 0)
    const gameModel =
      performanceModelAverage(playerGameSegs, m.volume, PERFORMANCE_MODEL_ALPHA[m.key]) ??
      mean(playerGameSegs.map(m.volume))
    return { key: m.key, label: m.label, unit: m.unit, postMatchValue, target: gameModel * WEEKLY_TARGET_MULTIPLIER[m.key] }
  })
}
