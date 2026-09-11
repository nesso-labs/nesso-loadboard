import type { DrillSegment, RawCsvRow, SegmentKind } from '../../types/domain'
import { upsertPlayerByName } from '../db/repo'
import { slugify } from '../utils'

export function classifySegmentKind(drillTitle: string): SegmentKind {
  const lower = drillTitle.toLowerCase()
  if (lower.includes('full session')) return 'full_session'
  if (lower.includes('warm')) return 'warmup'
  return 'drill'
}

export interface BuildResult {
  segments: DrillSegment[]
  warnings: string[]
}

/**
 * Groups raw rows by (player, exact drillTitle), resolves duplicates (keeps
 * the longer-duration row, drops the rest with a warning), and upserts a
 * Player record for every distinct name seen. Never blocks the whole import
 * over one messy player/row — this is an MVP demo, not a production ETL.
 */
export async function buildSegmentsForSession(sessionId: string, rows: RawCsvRow[]): Promise<BuildResult> {
  const warnings: string[] = []
  const byPlayerAndDrill = new Map<string, RawCsvRow[]>()

  for (const row of rows) {
    const key = `${row.playerDisplayName}::${row.drillTitle}`
    const list = byPlayerAndDrill.get(key) ?? []
    list.push(row)
    byPlayerAndDrill.set(key, list)
  }

  const playerNames = [...new Set(rows.map((r) => r.playerDisplayName))]
  const players = await Promise.all(playerNames.map((name) => upsertPlayerByName(name)))
  const playerIdByName = new Map(players.map((p) => [p.displayName, p.id]))

  const segments: DrillSegment[] = []

  for (const [key, group] of byPlayerAndDrill) {
    const [playerName, drillTitle] = key.split('::')
    let chosen = group[0]
    const dropped: { drillTitle: string; durationSec: number }[] = []

    if (group.length > 1) {
      chosen = group.reduce((longest, r) => (r.durationSec > longest.durationSec ? r : longest))
      for (const r of group) {
        if (r !== chosen) dropped.push({ drillTitle: r.drillTitle, durationSec: r.durationSec })
      }
      warnings.push(
        `${playerName} — "${drillTitle}" aveva ${group.length} righe duplicate: tenuta quella da ${chosen.durationSec}s, scartate le altre (${dropped.map((d) => `${d.durationSec}s`).join(', ')}).`,
      )
    }

    const playerId = playerIdByName.get(playerName)
    if (!playerId) continue

    const segmentKind = classifySegmentKind(drillTitle)
    const segment: DrillSegment = {
      id: `${sessionId}:${playerId}:${slugify(drillTitle)}`,
      sessionId,
      playerId,
      drillTitle,
      segmentKind,
      durationSec: chosen.durationSec,
      totalDistanceM: chosen.totalDistanceM,
      distancePerMin: chosen.distancePerMin,
      distanceZone4M: chosen.distanceZone4M,
      distanceZone5M: chosen.distanceZone5M,
      distanceZone6M: chosen.distanceZone6M,
      entriesZone5: chosen.entriesZone5,
      entriesZone6: chosen.entriesZone6,
      hsrM: chosen.hsrM,
      hsrPerMin: chosen.hsrPerMin,
      maxSpeedKmh: chosen.maxSpeedKmh,
      pctMaxSpeed: chosen.pctMaxSpeed,
      accZone3: chosen.accZone3,
      decZone3: chosen.decZone3,
      accZone4: chosen.accZone4,
      decZone4: chosen.decZone4,
      accZone5: chosen.accZone5,
      decZone5: chosen.decZone5,
      accZone6: chosen.accZone6,
      decZone6: chosen.decZone6,
      accPerMin: chosen.accPerMin,
      decPerMin: chosen.decPerMin,
      droppedDuplicates: dropped.length > 0 ? dropped : undefined,
      warnings: chosen.warnings.length > 0 ? chosen.warnings : undefined,
    }
    segments.push(segment)
  }

  // Informational-only: a warmup segment suspiciously close in duration to a
  // full_session row for the same player hints at an export artifact — never
  // auto-resolved, just surfaced.
  const byPlayer = new Map<string, DrillSegment[]>()
  for (const s of segments) {
    const list = byPlayer.get(s.playerId) ?? []
    list.push(s)
    byPlayer.set(s.playerId, list)
  }
  for (const [, playerSegments] of byPlayer) {
    const fullSessions = playerSegments.filter((s) => s.segmentKind === 'full_session')
    const warmups = playerSegments.filter((s) => s.segmentKind === 'warmup')
    for (const w of warmups) {
      for (const fs of fullSessions) {
        const diff = Math.abs(w.durationSec - fs.durationSec) / Math.max(fs.durationSec, 1)
        if (diff <= 0.15) {
          warnings.push(
            `Possibile artefatto di export per il giocatore: "${w.drillTitle}" (${w.durationSec}s) è vicino a "Full Session" (${fs.durationSec}s) — controllare manualmente.`,
          )
        }
      }
    }
  }

  return { segments, warnings }
}
