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
  const displayNameByPlayerId = new Map(players.map((p) => [p.id, p.displayName]))

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

  const byPlayer = new Map<string, DrillSegment[]>()
  for (const s of segments) {
    const list = byPlayer.get(s.playerId) ?? []
    list.push(s)
    byPlayer.set(s.playerId, list)
  }

  // Some exports (typically match days: "1stHalf"/"2ndHalf") never carry an
  // explicit "Full Session" row. Synthesize one by summing every other
  // segment for that player — safe here because these rows are genuinely
  // non-overlapping session parts, not a drill nested inside an existing
  // Full Session total (which would double-count).
  for (const [playerId, playerSegments] of byPlayer) {
    if (playerSegments.some((s) => s.segmentKind === 'full_session')) continue
    const sum = (getValue: (s: DrillSegment) => number) => playerSegments.reduce((total, s) => total + getValue(s), 0)
    const maxOf = (getValue: (s: DrillSegment) => number) => Math.max(0, ...playerSegments.map(getValue))
    const synthesized: DrillSegment = {
      id: `${sessionId}:${playerId}:full-session-synth`,
      sessionId,
      playerId,
      drillTitle: 'Full Session (stimata)',
      segmentKind: 'full_session',
      durationSec: sum((s) => s.durationSec),
      totalDistanceM: sum((s) => s.totalDistanceM),
      distancePerMin: 0, // recomputed below once duration is known
      distanceZone4M: sum((s) => s.distanceZone4M),
      distanceZone5M: sum((s) => s.distanceZone5M),
      distanceZone6M: sum((s) => s.distanceZone6M),
      entriesZone5: sum((s) => s.entriesZone5),
      entriesZone6: sum((s) => s.entriesZone6),
      hsrM: sum((s) => s.hsrM),
      hsrPerMin: 0,
      maxSpeedKmh: maxOf((s) => s.maxSpeedKmh),
      pctMaxSpeed: maxOf((s) => s.pctMaxSpeed),
      accZone3: sum((s) => s.accZone3),
      decZone3: sum((s) => s.decZone3),
      accZone4: sum((s) => s.accZone4),
      decZone4: sum((s) => s.decZone4),
      accZone5: sum((s) => s.accZone5),
      decZone5: sum((s) => s.decZone5),
      accZone6: sum((s) => s.accZone6),
      decZone6: sum((s) => s.decZone6),
      accPerMin: 0,
      decPerMin: 0,
      isSynthesizedFullSession: true,
    }
    const durationMin = synthesized.durationSec / 60
    if (durationMin > 0) {
      synthesized.distancePerMin = synthesized.totalDistanceM / durationMin
      synthesized.hsrPerMin = synthesized.hsrM / durationMin
      synthesized.accPerMin = sum((s) => s.accZone3 + s.accZone4 + s.accZone5 + s.accZone6) / durationMin
      synthesized.decPerMin = sum((s) => s.decZone3 + s.decZone4 + s.decZone5 + s.decZone6) / durationMin
    }
    segments.push(synthesized)
    const originalCount = playerSegments.length
    playerSegments.push(synthesized)
    warnings.push(
      `${displayNameByPlayerId.get(playerId) ?? playerId} — nessuna riga "Full Session" trovata: sessione totale calcolata sommando ${originalCount} drill (es. 1st/2nd Half).`,
    )
  }

  // Informational-only: a warmup segment suspiciously close in duration to a
  // full_session row for the same player hints at an export artifact — never
  // auto-resolved, just surfaced.
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
