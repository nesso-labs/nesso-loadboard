import type { AppSettings, DrillSegment, PlayerSessionAggregate, ZoneNumber } from '../../types/domain'

function zoneAcc(segment: DrillSegment, zone: ZoneNumber): number {
  if (zone === 3) return segment.accZone3
  if (zone === 4) return segment.accZone4
  if (zone === 5) return segment.accZone5
  return segment.accZone6
}

function zoneDec(segment: DrillSegment, zone: ZoneNumber): number {
  if (zone === 3) return segment.decZone3
  if (zone === 4) return segment.decZone4
  if (zone === 5) return segment.decZone5
  return segment.decZone6
}

export function distanceAbove14_4(segment: DrillSegment): number {
  return segment.distanceZone4M + segment.distanceZone5M + segment.distanceZone6M
}

/** == segment.hsrM, by construction (verified identity in the source CSV). */
export function distanceAbove19_8(segment: DrillSegment): number {
  return segment.distanceZone5M + segment.distanceZone6M
}

export function distanceAbove25_2(segment: DrillSegment): number {
  return segment.distanceZone6M
}

export function mechanicalWork(segment: DrillSegment, settings: AppSettings): number {
  const zones = settings.mechanicalWork.includeZonesForMechWork
  return zones.reduce((sum, z) => sum + zoneAcc(segment, z) + zoneDec(segment, z), 0)
}

export function mechanicalWorkPerMin(segment: DrillSegment, settings: AppSettings): number {
  const min = segment.durationSec / 60
  return min > 0 ? mechanicalWork(segment, settings) / min : 0
}

export function accModerateCount(segment: DrillSegment, settings: AppSettings): number {
  return settings.mechanicalWork.accModerateZones.reduce((sum, z) => sum + zoneAcc(segment, z), 0)
}

export function accHighCount(segment: DrillSegment, settings: AppSettings): number {
  return settings.mechanicalWork.accHighZones.reduce((sum, z) => sum + zoneAcc(segment, z), 0)
}

export function decModerateCount(segment: DrillSegment, settings: AppSettings): number {
  return settings.mechanicalWork.decModerateZones.reduce((sum, z) => sum + zoneDec(segment, z), 0)
}

export function decHighCount(segment: DrillSegment, settings: AppSettings): number {
  return settings.mechanicalWork.decHighZones.reduce((sum, z) => sum + zoneDec(segment, z), 0)
}

export function sprintCount(segment: DrillSegment, settings: AppSettings): number {
  return settings.sprintDefinition.entriesZonesForSprintCount.reduce(
    (sum, z) => sum + (z === 5 ? segment.entriesZone5 : segment.entriesZone6),
    0,
  )
}

/** Vendor-supplied variant (unknown internal reference) vs. app-tracked variant (vs. this player's own historical max). */
export function maxSpeedVacancyPct(segment: DrillSegment): number {
  return 100 - segment.pctMaxSpeed
}

export function maxSpeedVacancyVsPersonalBestPct(segment: DrillSegment, personalMaxSpeedKmh?: number): number | null {
  if (!personalMaxSpeedKmh || personalMaxSpeedKmh <= 0) return null
  return 100 * (1 - segment.maxSpeedKmh / personalMaxSpeedKmh)
}

/**
 * Approximate distance-based work:rest proxy — NOT a true time-based
 * work:rest ratio (that needs a raw positional trace this CSV doesn't have).
 * Callers must label this "approximate" and never present it as the real metric.
 */
export function approximateWorkRestRatio(segment: DrillSegment): number | null {
  const rest = segment.totalDistanceM - segment.hsrM
  return rest > 0 ? segment.hsrM / rest : null
}

export function aggregateFromFullSession(
  sessionId: string,
  playerId: string,
  fullSession: DrillSegment | undefined,
  allPlayerSegments: DrillSegment[],
  settings: AppSettings,
  rpe?: number,
): PlayerSessionAggregate {
  const durationSec = fullSession
    ? fullSession.durationSec
    : allPlayerSegments.reduce((sum, s) => sum + s.durationSec, 0)
  const totalDistanceM = fullSession
    ? fullSession.totalDistanceM
    : allPlayerSegments.reduce((sum, s) => sum + s.totalDistanceM, 0)

  const durationMin = durationSec / 60
  const sRpe = rpe !== undefined ? rpe * durationMin : undefined

  return {
    sessionId,
    playerId,
    durationMin,
    totalDistanceM,
    distanceAbove14_4M: fullSession
      ? distanceAbove14_4(fullSession)
      : allPlayerSegments.reduce((sum, s) => sum + distanceAbove14_4(s), 0),
    distanceAbove19_8M: fullSession
      ? distanceAbove19_8(fullSession)
      : allPlayerSegments.reduce((sum, s) => sum + distanceAbove19_8(s), 0),
    distanceAbove25_2M: fullSession
      ? distanceAbove25_2(fullSession)
      : allPlayerSegments.reduce((sum, s) => sum + distanceAbove25_2(s), 0),
    mechanicalWork: fullSession
      ? mechanicalWork(fullSession, settings)
      : allPlayerSegments.reduce((sum, s) => sum + mechanicalWork(s, settings), 0),
    mechanicalWorkPerMin: fullSession ? mechanicalWorkPerMin(fullSession, settings) : 0,
    maxSpeedKmh: Math.max(0, ...allPlayerSegments.map((s) => s.maxSpeedKmh)),
    pctMaxSpeedPeak: Math.max(0, ...allPlayerSegments.map((s) => s.pctMaxSpeed)),
    sprintCount: allPlayerSegments.reduce((sum, s) => sum + sprintCount(s, settings), 0),
    rpe,
    sRpe,
    dataCompleteness: fullSession ? 'full' : 'partial_no_full_session_row',
  }
}

export function isGameLikeDrill(drillTitle: string, settings: AppSettings): boolean {
  const lower = drillTitle.toLowerCase()
  return settings.gameDrillKeywords.some((kw) => lower.includes(kw.toLowerCase()))
}
