export interface DatedValue {
  date: string // ISO "YYYY-MM-DD"
  value: number
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()
  return Math.round(ms / (24 * 3600 * 1000))
}

/**
 * Trailing rolling average over a calendar-day window (not a fixed session
 * count) — degrades gracefully with sparse/irregular session dates, which is
 * the normal case for a real training calendar.
 */
export function rollingAverageByDateWindow(points: DatedValue[], windowDays: number): number[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((point, i) => {
    const windowPoints = sorted.filter((p, j) => j <= i && daysBetween(p.date, point.date) < windowDays)
    return windowPoints.reduce((sum, p) => sum + p.value, 0) / windowPoints.length
  })
}
