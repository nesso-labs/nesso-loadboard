import type { RawCsvRow, ReassignmentAudit } from '../../types/domain'
import { classifySegmentKind } from './segmentBuilder'

/**
 * Columns that must be *cumulative*: a player's "full session" row should
 * sum to at least what their own drill rows report (full session ⊇ its
 * constituent drills). Rate/max fields (per-min, %, Vmax) are deliberately
 * excluded — those aren't additive.
 */
const CUMULATIVE_COLUMNS: (keyof RawCsvRow)[] = [
  'totalDistanceM',
  'distanceZone4M',
  'distanceZone5M',
  'distanceZone6M',
  'hsrM',
  'entriesZone5',
  'entriesZone6',
  'accZone3',
  'decZone3',
  'accZone4',
  'decZone4',
  'accZone5',
  'decZone5',
  'accZone6',
  'decZone6',
]

const TOLERANCE_RATIO = 0.02

function violatedColumns(total: RawCsvRow, drills: RawCsvRow[]): string[] {
  return CUMULATIVE_COLUMNS.filter((col) => {
    const sum = drills.reduce((s, d) => s + (d[col] as number), 0)
    const tolerance = Math.max(sum * TOLERANCE_RATIO, 1)
    return (total[col] as number) < sum - tolerance
  })
}

export interface ReconcileResult {
  rows: RawCsvRow[]
  audits: ReassignmentAudit[]
}

/**
 * Detects the "shifted name" export bug: a player's Full Session total is
 * inconsistent with their own drill rows (violates the cumulative-sum
 * invariant), but fits the NEXT player in file order instead — a common
 * artifact when a roster row is inserted/removed mid-export and every
 * subsequent total silently shifts by one name. Reassigns with a full,
 * human-readable audit trail; never destroys data, only relabels which
 * player a row belongs to. Bounded to a single forward pass — this is an
 * MVP heuristic for a known real bug pattern, not a general solver.
 */
export function reconcileRows(rows: RawCsvRow[]): ReconcileResult {
  const orderedNames: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (!seen.has(row.playerDisplayName)) {
      seen.add(row.playerDisplayName)
      orderedNames.push(row.playerDisplayName)
    }
  }

  // Mutable working copy — reassignment just rewrites playerDisplayName.
  const workingRows = rows.map((r) => ({ ...r }))
  const rowsByPlayer = new Map<string, typeof workingRows>()
  for (const row of workingRows) {
    const list = rowsByPlayer.get(row.playerDisplayName) ?? []
    list.push(row)
    rowsByPlayer.set(row.playerDisplayName, list)
  }

  const fullSessionOf = (name: string) =>
    (rowsByPlayer.get(name) ?? []).find((r) => classifySegmentKind(r.drillTitle) === 'full_session')
  const drillsOf = (name: string) =>
    (rowsByPlayer.get(name) ?? []).filter((r) => classifySegmentKind(r.drillTitle) !== 'full_session')

  const audits: ReassignmentAudit[] = []
  const MAX_REASSIGNMENTS = 20 // backstop against a pathological/malformed file — never loop forever

  for (let i = 0; i < orderedNames.length - 1 && audits.length < MAX_REASSIGNMENTS; i++) {
    const player = orderedNames[i]
    const nextPlayer = orderedNames[i + 1]
    const total = fullSessionOf(player)
    if (!total) continue

    const violated = violatedColumns(total, drillsOf(player))
    if (violated.length === 0) continue

    // Only reassign if the next player has no full-session row of their own
    // yet — never overwrite a player's genuine total.
    if (fullSessionOf(nextPlayer)) continue

    const stillViolatedForNext = violatedColumns(total, drillsOf(nextPlayer))
    if (stillViolatedForNext.length > 0) continue // doesn't fit the next player either — leave as an unresolved warning

    const violatedLabels = violated.join(', ')
    audits.push({
      rowIndex: total.rowIndex,
      drillTitle: total.drillTitle,
      fromPlayerName: player,
      toPlayerName: nextPlayer,
      violatedColumns: violated,
      reason: `Il totale attribuito a ${player} viola l'invariante cumulativo (${violatedLabels}): è inferiore alla somma dei suoi stessi drill. I valori sono invece coerenti con i drill di ${nextPlayer} — riga riassegnata.`,
    })

    total.playerDisplayName = nextPlayer
    rowsByPlayer.set(player, (rowsByPlayer.get(player) ?? []).filter((r) => r !== total))
    rowsByPlayer.set(nextPlayer, [...(rowsByPlayer.get(nextPlayer) ?? []), total])
  }

  return { rows: workingRows, audits }
}
