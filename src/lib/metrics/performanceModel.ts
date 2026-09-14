import type { DrillSegment } from '../../types/domain'
import { mean } from '../utils'

const MIN_VALID_MINUTES = 15
const MATCH_DURATION_MIN = 90

/**
 * Power-law normalization: projects a match appearance's observed intensity
 * (volume / minutes played) out to a full 90', tapered by `alpha` so a short
 * cameo isn't naively scaled up 1:1. Appearances under 15' are excluded —
 * too little signal to normalize reliably (subs/late cameos).
 */
export function normalizeVolumeTo90Min(
  segment: DrillSegment,
  volume: (s: DrillSegment) => number,
  alpha: number,
): number | null {
  const minutesPlayed = segment.durationSec / 60
  if (minutesPlayed < MIN_VALID_MINUTES) return null
  const observedIntensity = volume(segment) / minutesPlayed
  const intensity90 = observedIntensity * Math.pow(minutesPlayed / MATCH_DURATION_MIN, alpha)
  return intensity90 * MATCH_DURATION_MIN
}

/**
 * The historical "performance model" for a volume metric: the arithmetic
 * mean, across every valid (>=15') match appearance in `matchSegments`, of
 * that appearance's volume normalized to 90' — the "typical full match" a
 * player's (or the team's) game data implies, not a raw average of partial
 * appearances.
 */
export function performanceModelAverage(
  matchSegments: DrillSegment[],
  volume: (s: DrillSegment) => number,
  alpha: number,
): number | null {
  const normalized = matchSegments
    .map((s) => normalizeVolumeTo90Min(s, volume, alpha))
    .filter((v): v is number => v !== null)
  return normalized.length > 0 ? mean(normalized) : null
}
