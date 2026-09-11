import Papa from 'papaparse'
import type { RawCsvRow } from '../../types/domain'

const EXPECTED_HEADERS = [
  'Player Display Name',
  'Drill Title',
  'Total Time',
  'Total Distance',
  'Distance Per Min',
  'Distance Zone 4 (Absolute)',
  'Distance Zone 5 (Absolute)',
  'Distance Zone 6 (Absolute)',
  'Entries Zone 5 (Absolute)',
  'Entries Zone 6 (Absolute)',
  'HSR',
  'HSR Per Minute (Absolute)',
  'Max Speed',
  '% Max Speed',
  'Accelerations Zone 3 (Absolute)',
  'Decelerations Zone 3 (Absolute)',
  'Accelerations Zone 4 (Absolute)',
  'Decelerations Zone 4 (Absolute)',
  'Accelerations Zone 5 (Absolute)',
  'Decelerations Zone 5 (Absolute)',
  'Accelerations Zone 6 (Absolute)',
  'Decelerations Zone 6 (Absolute)',
  'Accelerations Per Min (Absolute)',
  'Decels Per Min (Absolute)',
] as const

export interface ParseResult {
  rows: RawCsvRow[]
  globalWarnings: string[]
  rowCount: number
}

export class CsvImportError extends Error {}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
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
    delimiter: ';',
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  })

  const headers = result.meta.fields ?? []
  const missing = EXPECTED_HEADERS.filter((h) => !headers.includes(h))
  if (missing.length > 0) {
    throw new CsvImportError(
      `Il CSV non contiene le colonne attese: ${missing.join(', ')}. Controlla che sia l'export corretto.`,
    )
  }

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

      const duration = parseDurationToSeconds(raw['Total Time'])
      push(duration)
      const totalDistanceM = parseLocaleNumber(raw['Total Distance'])
      push(totalDistanceM)
      const distancePerMin = parseLocaleNumber(raw['Distance Per Min'])
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

      const distanceZone4M = parseLocaleNumber(raw['Distance Zone 4 (Absolute)'])
      push(distanceZone4M)
      const distanceZone5M = parseLocaleNumber(raw['Distance Zone 5 (Absolute)'])
      push(distanceZone5M)
      const distanceZone6M = parseLocaleNumber(raw['Distance Zone 6 (Absolute)'])
      push(distanceZone6M)
      const entriesZone5 = parseLocaleNumber(raw['Entries Zone 5 (Absolute)'])
      push(entriesZone5)
      const entriesZone6 = parseLocaleNumber(raw['Entries Zone 6 (Absolute)'])
      push(entriesZone6)
      const hsrM = parseLocaleNumber(raw['HSR'])
      push(hsrM)
      const hsrPerMin = parseLocaleNumber(raw['HSR Per Minute (Absolute)'])
      push(hsrPerMin)
      const maxSpeedKmh = parseLocaleNumber(raw['Max Speed'])
      push(maxSpeedKmh)
      const pctMaxSpeed = parseLocaleNumber(raw['% Max Speed'])
      push(pctMaxSpeed)
      const accZone3 = parseLocaleNumber(raw['Accelerations Zone 3 (Absolute)'])
      push(accZone3)
      const decZone3 = parseLocaleNumber(raw['Decelerations Zone 3 (Absolute)'])
      push(decZone3)
      const accZone4 = parseLocaleNumber(raw['Accelerations Zone 4 (Absolute)'])
      push(accZone4)
      const decZone4 = parseLocaleNumber(raw['Decelerations Zone 4 (Absolute)'])
      push(decZone4)
      const accZone5 = parseLocaleNumber(raw['Accelerations Zone 5 (Absolute)'])
      push(accZone5)
      const decZone5 = parseLocaleNumber(raw['Decelerations Zone 5 (Absolute)'])
      push(decZone5)
      const accZone6 = parseLocaleNumber(raw['Accelerations Zone 6 (Absolute)'])
      push(accZone6)
      const decZone6 = parseLocaleNumber(raw['Decelerations Zone 6 (Absolute)'])
      push(decZone6)
      const accPerMin = parseLocaleNumber(raw['Accelerations Per Min (Absolute)'])
      push(accPerMin)
      const decPerMin = parseLocaleNumber(raw['Decels Per Min (Absolute)'])
      push(decPerMin)

      const playerDisplayName = (raw['Player Display Name'] ?? '').trim()
      const drillTitle = (raw['Drill Title'] ?? '').trim()

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
