import type { DrillSegment, Session, TrainingType } from '../../types/domain'

/** The 4 training types that make up one "textbook" microcycle between matches. */
const REQUIRED_TRAINING_TYPES: TrainingType[] = ['ripresa', 'forza', 'metabolico_alte_velocita', 'rifinitura']

/** Below this many attended sessions in the current (in-progress) microcycle, the % is unreliable — flagged with an asterisk, not hidden. */
const LOW_SAMPLE_THRESHOLD = 3

export type DenominatorSource = 'valid-cycles' | 'per-type-fallback' | 'insufficient-data'

export interface MicrocycleCompletion {
  numerator: number
  denominator: number | null
  pct: number | null
  denominatorSource: DenominatorSource
  validCycleCount: number
  sessionsSinceLastMatch: number
  lowSample: boolean
}

function sortByDate(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.importedAt.localeCompare(b.importedAt))
}

/** Most recent match session's date, or null if no match has been recorded yet. */
export function lastMatchDate(sessions: Session[]): string | null {
  const matches = sortByDate(sessions.filter((s) => s.type === 'match'))
  return matches.length > 0 ? matches[matches.length - 1].date : null
}

/** Training sessions strictly between two match dates (exclusive of both bounds) — or, when `beforeDate` is null, everything up to (not including) `afterMatchDate`'s... actually: everything AFTER afterMatchDate when beforeMatchDate is null (the in-progress, not-yet-closed cycle). */
function trainingSessionsInWindow(sessions: Session[], afterDateExclusive: string | null, beforeDateExclusive: string | null): Session[] {
  return sortByDate(
    sessions.filter((s) => {
      if (s.type !== 'training') return false
      if (afterDateExclusive !== null && s.date <= afterDateExclusive) return false
      if (beforeDateExclusive !== null && s.date >= beforeDateExclusive) return false
      return true
    }),
  )
}

/** STEP 1 — training sessions since the last match (the in-progress microcycle), team-wide (not player-specific: attendance is handled separately). */
export function currentMicrocycleSessions(sessions: Session[]): Session[] {
  const lastMatch = lastMatchDate(sessions)
  return trainingSessionsInWindow(sessions, lastMatch, null)
}

/**
 * STEP 2 — partitions history into the training-session groups that sit
 * strictly between two consecutive matches (the in-progress group after the
 * LAST match is excluded here — that's currentMicrocycleSessions, not history).
 */
export function historicalMicrocycleGroups(sessions: Session[]): Session[][] {
  const matches = sortByDate(sessions.filter((s) => s.type === 'match'))
  const groups: Session[][] = []
  for (let i = 0; i < matches.length - 1; i++) {
    const group = trainingSessionsInWindow(sessions, matches[i].date, matches[i + 1].date)
    if (group.length > 0) groups.push(group)
  }
  return groups
}

/**
 * A historical microcycle is "valid" only with EXACTLY 4 training sessions,
 * one each of Ripresa/Forza/Metabolico+alte velocità/Rifinitura — no extra
 * session, no duplicate type, Recupero attivo/Mix not part of the recipe.
 */
export function isValidMicrocycle(group: Session[]): boolean {
  if (group.length !== 4) return false
  const types = group.map((s) => s.trainingType)
  if (types.some((t) => !t)) return false
  const uniqueTypes = new Set(types)
  if (uniqueTypes.size !== 4) return false
  return REQUIRED_TRAINING_TYPES.every((t) => uniqueTypes.has(t))
}

/** Sum of a metric across a session group, for one player — sessions the player has no segment for simply don't contribute (their absence isn't fabricated as 0-with-full-weight, it's just not counted, same spirit as the rest of the app's "never fabricate" rule). */
function sumMetricForPlayer(
  group: Session[],
  playerId: string,
  fullSessionByPlayerAndSession: Map<string, DrillSegment>,
  metric: (s: DrillSegment) => number,
): { sum: number; attended: number } {
  let sum = 0
  let attended = 0
  for (const session of group) {
    const seg = fullSessionByPlayerAndSession.get(`${session.id}:${playerId}`)
    if (seg) {
      sum += metric(seg)
      attended++
    }
  }
  return { sum, attended }
}

/** Average per-type load for a player across ALL their training sessions of that type — the fallback denominator basis when no complete 4-session historical microcycle exists yet. */
function perTypeAverageSum(
  sessions: Session[],
  playerId: string,
  fullSessionByPlayerAndSession: Map<string, DrillSegment>,
  metric: (s: DrillSegment) => number,
): { sum: number; typesWithData: number } {
  let sum = 0
  let typesWithData = 0
  for (const type of REQUIRED_TRAINING_TYPES) {
    const sessionsOfType = sessions.filter((s) => s.type === 'training' && s.trainingType === type)
    const values: number[] = []
    for (const session of sessionsOfType) {
      const seg = fullSessionByPlayerAndSession.get(`${session.id}:${playerId}`)
      if (seg) values.push(metric(seg))
    }
    if (values.length > 0) {
      sum += values.reduce((a, b) => a + b, 0) / values.length
      typesWithData++
    }
  }
  return { sum, typesWithData }
}

/**
 * Full computation for one player: current in-progress load (since the last
 * match) as a % of what a "typical" 4-session microcycle costs them
 * historically. See the module doc above for the exact STEP 1-3 recipe.
 */
export function computeMicrocycleCompletion(
  playerId: string,
  allSessions: Session[],
  allSegments: DrillSegment[],
  metric: (s: DrillSegment) => number,
): MicrocycleCompletion {
  const fullSessionByPlayerAndSession = new Map<string, DrillSegment>()
  for (const seg of allSegments) {
    if (seg.segmentKind === 'full_session') fullSessionByPlayerAndSession.set(`${seg.sessionId}:${seg.playerId}`, seg)
  }

  const current = currentMicrocycleSessions(allSessions)
  const { sum: numerator, attended } = sumMetricForPlayer(current, playerId, fullSessionByPlayerAndSession, metric)

  const historicalGroups = historicalMicrocycleGroups(allSessions)
  const validGroups = historicalGroups.filter(isValidMicrocycle)
  const validSums = validGroups
    .map((g) => sumMetricForPlayer(g, playerId, fullSessionByPlayerAndSession, metric))
    .filter((r) => r.attended > 0)

  let denominator: number | null = null
  let denominatorSource: DenominatorSource = 'insufficient-data'

  if (validSums.length > 0) {
    denominator = validSums.reduce((a, b) => a + b.sum, 0) / validSums.length
    denominatorSource = 'valid-cycles'
  } else {
    // Scoped to historical sessions only (strictly before the last match) —
    // must never include the in-progress window we're measuring in STEP 1,
    // or the comparison becomes circular.
    const fallback = perTypeAverageSum(historicalGroups.flat(), playerId, fullSessionByPlayerAndSession, metric)
    if (fallback.typesWithData > 0) {
      denominator = fallback.sum
      denominatorSource = 'per-type-fallback'
    }
  }

  const pct = denominator && denominator > 0 ? (numerator / denominator) * 100 : null

  return {
    numerator,
    denominator,
    pct,
    denominatorSource,
    validCycleCount: validGroups.length,
    sessionsSinceLastMatch: attended,
    lowSample: attended < LOW_SAMPLE_THRESHOLD,
  }
}
