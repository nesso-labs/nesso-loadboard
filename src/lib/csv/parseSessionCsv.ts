import Papa from 'papaparse'
import type { RawCsvRow } from '../../types/domain'

/**
 * Two vendor export dialects seen in the wild so far: an older
 * "Player Display Name" / semicolon-delimited style, and a newer camelCase /
 * comma-delimited style with reordered words (e.g. "Total Distance" vs
 * "distanceTotal"). Word order differs, not just casing/spacing, so this is
 * an explicit alias table rather than a normalize-and-match heuristic.
 */
const HEADER_ALIASES = {
  playerDisplayName: ['Player Display Name', 'playerDisplayName'],
  drillTitle: ['Drill Title', 'drillTitle'],
  totalTime: ['Total Time', 'totalTime'],
  totalDistanceM: ['Total Distance', 'distanceTotal'],
  distancePerMin: ['Distance Per Min', 'distancePerMin'],
  distanceZone4M: ['Distance Zone 4 (Absolute)', 'distanceZ4Abs'],
  distanceZone5M: ['Distance Zone 5 (Absolute)', 'distanceZ5Abs'],
  distanceZone6M: ['Distance Zone 6 (Absolute)', 'distanceZ6Abs'],
  entriesZone5: ['Entries Zone 5 (Absolute)', 'entriesZ5Abs'],
  entriesZone6: ['Entries Zone 6 (Absolute)', 'entriesZ6Abs'],
  hsrM: ['HSR', 'cmHSR'],
  hsrPerMin: ['HSR Per Minute (Absolute)', 'hsrAbsPerMin'],
  maxSpeedKmh: ['Max Speed', 'maxSpeed'],
  pctMaxSpeed: ['% Max Speed', 'cm%MaxSpeed'],
  accZone3: ['Accelerations Zone 3 (Absolute)', 'accelerationsZ3Abs'],
  decZone3: ['Decelerations Zone 3 (Absolute)', 'decelerationsZ3Abs'],
  accZone4: ['Accelerations Zone 4 (Absolute)', 'accelerationsZ4Abs'],
  decZone4: ['Decelerations Zone 4 (Absolute)', 'decelerationsZ4Abs'],
  accZone5: ['Accelerations Zone 5 (Absolute)', 'accelerationsZ5Abs'],
  decZone5: ['Decelerations Zone 5 (Absolute)', 'decelerationsZ5Abs'],
  accZone6: ['Accelerations Zone 6 (Absolute)', 'accelerationsZ6Abs'],
  decZone6: ['Decelerations Zone 6 (Absolute)', 'decelerationsZ6Abs'],
  accPerMin: ['Accelerations Per Min (Absolute)', 'accelsPerMinAbs'],
  decPerMin: ['Decels Per Min (Absolute)', 'decelsPerMinAbs'],
} as const

type InternalField = keyof typeof HEADER_ALIASES

export interface ParseResult {
  rows: RawCsvRow[]
  globalWarnings: string[]
  rowCount: number
}

export class CsvImportError extends Error {}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function resolveHeaderMap(actualHeaders: string[]): { map: Partial<Record<InternalField, string>>; missing: InternalField[] } {
  const map: Partial<Record<InternalField, string>> = {}
  const missing: InternalField[] = []
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [InternalField, readonly string[]][]) {
    const found = aliases.find((alias) => actualHeaders.includes(alias))
    if (found) map[field] = found
    else missing.push(field)
  }
  return { map, missing }
}

function parseLocaleNumber(raw: string | undefined): { value: number; warning?: string } {
  const s = (raw ?? '').trim()
  if (s === '') return { value: 0 }
  let normalized = s
  if (s.includes(',') && s.includes('.')) {
    normalized = s.replace(/,/g, '')
  } else if (s.includes(',') && !s.includes('.')) {
    normalized = s.replace(',', '.')
  }
  const value = Number(normalized)
  if (Number.isNaN(value)) {
    return { value: 0, warning: `could not parse number "${raw}", coerced to 0` }
  }
  return { value }
}

function parseDurationToSeconds(raw: string | undefined): { value: number; warning?: string } {
  const s = (raw ?? '').trim()
  const parts = s.split(':').map(Number)
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) {
    return { value: 0, warning: `could not parse duration "${raw}", coerced to 0` }
  }
  const [h, m, sec] = parts
  return { value: h * 3600 + m * 60 + sec }
}

export function parseSessionCsv(fileText: string): ParseResult {
  const text = stripBom(fileText)
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
    // No fixed delimiter: vendor exports seen so far use both `;` and `,` —
    // Papa's auto-detection handles either.
  })

  const headers = result.meta.fields ?? []
  const { map, missing } = resolveHeaderMap(headers)
  if (missing.length > 0) {
    throw new CsvImportError(
      `Il CSV non contiene le colonne attese: ${missing.join(', ')}. Controlla che sia l'export corretto.`,
    )
  }
  const h = map as Record<InternalField, string>

  const globalWarnings: string[] = []
  if (result.errors.length > 0) {
    globalWarnings.push(`${result.errors.length} righe con errori di parsing (ignorate o corrette a 0).`)
  }

  const rows: RawCsvRow[] = result.data
    .map((raw, index) => {
      const warnings: string[] = []
      const push = (r: { warning?: string }) => {
        if (r.warning) warnings.push(r.warning)
      }

      const duration = parseDurationToSeconds(raw[h.totalTime])
      push(duration)
      const totalDistanceM = parseLocaleNumber(raw[h.totalDistanceM])
      push(totalDistanceM)
      const distancePerMin = parseLocaleNumber(raw[h.distancePerMin])
      push(distancePerMin)

      // Non-blocking cross-check: recomputed distance/min vs the vendor's own value.
      if (duration.value > 0) {
        const recomputed = totalDistanceM.value / (duration.value / 60)
        const vendor = distancePerMin.value
        if (vendor > 0 && Math.abs(recomputed - vendor) / vendor > 0.02) {
          warnings.push(
            `Distance Per Min (${vendor}) diverge da totale/durata (${recomputed.toFixed(1)}) di oltre il 2%`,
          )
        }
      }

      const distanceZone4M = parseLocaleNumber(raw[h.distanceZone4M])
      push(distanceZone4M)
      const distanceZone5M = parseLocaleNumber(raw[h.distanceZone5M])
      push(distanceZone5M)
      const distanceZone6M = parseLocaleNumber(raw[h.distanceZone6M])
      push(distanceZone6M)
      const entriesZone5 = parseLocaleNumber(raw[h.entriesZone5])
      push(entriesZone5)
      const entriesZone6 = parseLocaleNumber(raw[h.entriesZone6])
      push(entriesZone6)
      const hsrM = parseLocaleNumber(raw[h.hsrM])
      push(hsrM)
      const hsrPerMin = parseLocaleNumber(raw[h.hsrPerMin])
      push(hsrPerMin)
      const maxSpeedKmh = parseLocaleNumber(raw[h.maxSpeedKmh])
      push(maxSpeedKmh)
      const pctMaxSpeed = parseLocaleNumber(raw[h.pctMaxSpeed])
      push(pctMaxSpeed)
      const accZone3 = parseLocaleNumber(raw[h.accZone3])
      push(accZone3)
      const decZone3 = parseLocaleNumber(raw[h.decZone3])
      push(decZone3)
      const accZone4 = parseLocaleNumber(raw[h.accZone4])
      push(accZone4)
      const decZone4 = parseLocaleNumber(raw[h.decZone4])
      push(decZone4)
      const accZone5 = parseLocaleNumber(raw[h.accZone5])
      push(accZone5)
      const decZone5 = parseLocaleNumber(raw[h.decZone5])
      push(decZone5)
      const accZone6 = parseLocaleNumber(raw[h.accZone6])
      push(accZone6)
      const decZone6 = parseLocaleNumber(raw[h.decZone6])
      push(decZone6)
      const accPerMin = parseLocaleNumber(raw[h.accPerMin])
      push(accPerMin)
      const decPerMin = parseLocaleNumber(raw[h.decPerMin])
      push(decPerMin)

      const playerDisplayName = (raw[h.playerDisplayName] ?? '').trim()
      const drillTitle = (raw[h.drillTitle] ?? '').trim()

      if (!playerDisplayName) {
        warnings.push('riga senza nome giocatore, verrà ignorata')
      }

      const row: RawCsvRow = {
        playerDisplayName,
        drillTitle,
        durationSec: duration.value,
        totalDistanceM: totalDistanceM.value,
        distancePerMin: distancePerMin.value,
        distanceZone4M: distanceZone4M.value,
        distanceZone5M: distanceZone5M.value,
        distanceZone6M: distanceZone6M.value,
        entriesZone5: entriesZone5.value,
        entriesZone6: entriesZone6.value,
        hsrM: hsrM.value,
        hsrPerMin: hsrPerMin.value,
        maxSpeedKmh: maxSpeedKmh.value,
        pctMaxSpeed: pctMaxSpeed.value,
        accZone3: accZone3.value,
        decZone3: decZone3.value,
        accZone4: accZone4.value,
        decZone4: decZone4.value,
        accZone5: accZone5.value,
        decZone5: decZone5.value,
        accZone6: accZone6.value,
        decZone6: decZone6.value,
        accPerMin: accPerMin.value,
        decPerMin: decPerMin.value,
        rowIndex: index,
        warnings,
      }
      return row
    })
    .filter((row) => row.playerDisplayName.length > 0)

  return { rows, globalWarnings, rowCount: rows.length }
}
