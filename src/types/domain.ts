// Canonical data model — see the plan doc for the full rationale behind each
// assumption. Everything derived from the CSV reads its thresholds from
// AppSettings; nothing is hardcoded to a specific vendor's zone boundaries.

export type SegmentKind = 'full_session' | 'warmup' | 'drill'
export type SessionType = 'training' | 'match'
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD' | 'UNSPECIFIED'

/** One CSV row, after type coercion, before grouping/aggregation. */
export interface RawCsvRow {
  playerDisplayName: string
  drillTitle: string
  durationSec: number
  totalDistanceM: number
  distancePerMin: number
  distanceZone4M: number
  distanceZone5M: number
  distanceZone6M: number
  entriesZone5: number
  entriesZone6: number
  hsrM: number
  hsrPerMin: number
  maxSpeedKmh: number
  pctMaxSpeed: number
  accZone3: number
  decZone3: number
  accZone4: number
  decZone4: number
  accZone5: number
  decZone5: number
  accZone6: number
  decZone6: number
  accPerMin: number
  decPerMin: number
  rowIndex: number
  warnings: string[]
}

/** A training/match session — date/label/type are user-supplied at import time. */
export interface Session {
  id: string
  date: string // ISO "YYYY-MM-DD"
  label: string
  type: SessionType
  importedAt: string
  sourceFileName?: string
  rawRowCount: number
  warningCount: number
  notes?: string
}

/** A player, keyed by a slug of their display name (no roster ID exists in the CSV). */
export interface Player {
  id: string
  displayName: string
  position: Position
  personalMaxSpeedKmh?: number
  active: boolean
  createdAt: string
  updatedAt: string
}

/** One player+drill row within a session (post dedup/classification). */
export interface DrillSegment {
  id: string // `${sessionId}:${playerId}:${slug(drillTitle)}`
  sessionId: string
  playerId: string
  drillTitle: string
  segmentKind: SegmentKind
  durationSec: number
  totalDistanceM: number
  distancePerMin: number
  distanceZone4M: number
  distanceZone5M: number
  distanceZone6M: number
  entriesZone5: number
  entriesZone6: number
  hsrM: number
  hsrPerMin: number
  maxSpeedKmh: number
  pctMaxSpeed: number
  accZone3: number
  decZone3: number
  accZone4: number
  decZone4: number
  accZone5: number
  decZone5: number
  accZone6: number
  decZone6: number
  accPerMin: number
  decPerMin: number
  droppedDuplicates?: { drillTitle: string; durationSec: number }[]
  warnings?: string[]
}

/** Manual RPE entry for one player in one session (Borg CR10 by default). */
export interface RpeEntry {
  id: string // `${sessionId}:${playerId}`
  sessionId: string
  playerId: string
  rpe: number
  sRpe: number // rpe * full_session duration (min), cached at entry time
  enteredAt: string
}

export type ZoneNumber = 3 | 4 | 5 | 6

export interface AppSettings {
  id: 'app-settings'
  schemaVersion: 1
  speedZonesKmh: {
    zone4MinKmh: number
    zone5MinKmh: number
    zone6MinKmh: number
  }
  useVendorZoneLabelsOnly: boolean
  mechanicalWork: {
    includeZonesForMechWork: ZoneNumber[]
    accModerateZones: ZoneNumber[]
    accHighZones: ZoneNumber[]
    decModerateZones: ZoneNumber[]
    decHighZones: ZoneNumber[]
  }
  sprintDefinition: {
    entriesZonesForSprintCount: (5 | 6)[]
  }
  gameDrillKeywords: string[]
  rpeScale: {
    type: 'borg-cr10'
    min: number
    max: number
  }
  weeklyTargets?: Partial<Record<string, number>>
  rollingWindowDays: number
}

/** Derived, computed on demand from a session's segments — not persisted as-is. */
export interface PlayerSessionAggregate {
  sessionId: string
  playerId: string
  durationMin: number
  totalDistanceM: number
  distanceAbove14_4M: number
  distanceAbove19_8M: number
  distanceAbove25_2M: number
  mechanicalWork: number
  mechanicalWorkPerMin: number
  maxSpeedKmh: number
  pctMaxSpeedPeak: number
  sprintCount: number
  rpe?: number
  sRpe?: number
  dataCompleteness: 'full' | 'partial_no_full_session_row'
}
