// Canonical data model — see the plan doc for the full rationale behind each
// assumption. Everything derived from the CSV reads its thresholds from
// AppSettings; nothing is hardcoded to a specific vendor's zone boundaries.

export type SegmentKind = 'full_session' | 'warmup' | 'drill'
export type SessionType = 'training' | 'match'
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD' | 'UNSPECIFIED'

/** Sub-classification of a training session — lets the trainer compare like-for-like (e.g. Forza vs Forza), not just training-vs-training. Not applicable to matches. */
export type TrainingType = 'ripresa' | 'forza' | 'metabolico_alte_velocita' | 'rifinitura' | 'recupero_attivo' | 'mix'

export const TRAINING_TYPE_LABEL: Record<TrainingType, string> = {
  ripresa: 'Ripresa',
  forza: 'Forza',
  metabolico_alte_velocita: 'Metabolico + alte velocità',
  rifinitura: 'Rifinitura',
  recupero_attivo: 'Recupero attivo',
  mix: 'Mix',
}

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

/** One row reassigned from its file-order player to another during import
 *  reconciliation (a shifted/misattributed name in the source export). */
export interface ReassignmentAudit {
  rowIndex: number
  drillTitle: string
  fromPlayerName: string
  toPlayerName: string
  violatedColumns: string[]
  reason: string
}

/** A training/match session — date/label/type are user-supplied at import time. */
export interface Session {
  id: string
  date: string // ISO "YYYY-MM-DD"
  label: string
  type: SessionType
  /** Only meaningful when type === 'training'. */
  trainingType?: TrainingType
  importedAt: string
  sourceFileName?: string
  rawRowCount: number
  warningCount: number
  notes?: string
  /** Rows the reconciliation pass reassigned to a different player — see ReassignmentAudit. */
  reconciliation?: ReassignmentAudit[]
}

/** A player, keyed by a slug of their display name (no roster ID exists in the CSV). */
export interface Player {
  id: string
  displayName: string
  position: Position
  personalMaxSpeedKmh?: number
  /** Has a human confirmed personalMaxSpeedKmh is a trustworthy reference? See lib/metrics/pb.ts. */
  pbConfirmed: boolean
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
  /** True if no "Full Session"-labeled row existed for this player and this
   *  segment was synthesized by summing all of their other segments instead
   *  (e.g. match-day exports with only "1stHalf"/"2ndHalf" rows). */
  isSynthesizedFullSession?: boolean
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
  alertThresholds: {
    /** Below this % of the player's own recorded max speed -> sprint-deficit flag. */
    maxSpeedDeficitPct: number
    /** Relative deviation above the session's team median (same bands as the Drills heatmap) -> high-load flag. */
    highMechWorkRelative: number
    highVolumeRelative: number
    highSRpeRelative: number
  }
}

