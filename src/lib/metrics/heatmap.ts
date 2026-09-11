export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export type HeatBand = 'low-strong' | 'low-mild' | 'neutral' | 'high-mild' | 'high-strong'

/**
 * Buckets a value's relative deviation from the column median into a
 * diverging band (blue = below median, red = above) — a magnitude cue, not a
 * good/bad judgement: the raw number is always shown alongside it.
 */
export function heatBand(value: number, columnMedian: number): HeatBand {
  if (columnMedian === 0) return 'neutral'
  const relative = (value - columnMedian) / Math.abs(columnMedian)
  if (relative <= -0.25) return 'low-strong'
  if (relative <= -0.1) return 'low-mild'
  if (relative >= 0.25) return 'high-strong'
  if (relative >= 0.1) return 'high-mild'
  return 'neutral'
}

export const HEAT_BAND_VAR: Record<HeatBand, string | undefined> = {
  'low-strong': 'var(--heat-low-strong)',
  'low-mild': 'var(--heat-low-mild)',
  neutral: undefined,
  'high-mild': 'var(--heat-high-mild)',
  'high-strong': 'var(--heat-high-strong)',
}
