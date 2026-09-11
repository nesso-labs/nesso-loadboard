import type { RpeEntry, Session, SessionType } from '../../types/domain'
import { putRpeEntries, putSegments, putSession } from '../db/repo'
import { parseSessionCsv } from './parseSessionCsv'
import { buildSegmentsForSession } from './segmentBuilder'

export interface SessionMetadataInput {
  date: string
  label: string
  type: SessionType
}

export interface StagedImport {
  sessionId: string
  metadata: SessionMetadataInput
  sourceFileName: string
  segments: Awaited<ReturnType<typeof buildSegmentsForSession>>['segments']
  warnings: string[]
  rawRowCount: number
}

/** Parse + build segments in-memory, without touching IndexedDB yet. */
export async function stageImport(fileText: string, fileName: string, metadata: SessionMetadataInput): Promise<StagedImport> {
  const sessionId = crypto.randomUUID()
  const parsed = parseSessionCsv(fileText)
  const { segments, warnings } = await buildSegmentsForSession(sessionId, parsed.rows)

  return {
    sessionId,
    metadata,
    sourceFileName: fileName,
    segments,
    warnings: [...parsed.globalWarnings, ...warnings],
    rawRowCount: parsed.rowCount,
  }
}

/** Persist a staged import (and any RPE entered for it) to IndexedDB. */
export async function commitImport(staged: StagedImport, rpeByPlayerId: Record<string, number>): Promise<Session> {
  const now = new Date().toISOString()
  const session: Session = {
    id: staged.sessionId,
    date: staged.metadata.date,
    label: staged.metadata.label,
    type: staged.metadata.type,
    importedAt: now,
    sourceFileName: staged.sourceFileName,
    rawRowCount: staged.rawRowCount,
    warningCount: staged.warnings.length,
  }

  await putSession(session)
  await putSegments(staged.segments)

  const fullSessionDurationByPlayer = new Map<string, number>()
  for (const seg of staged.segments) {
    if (seg.segmentKind === 'full_session') {
      fullSessionDurationByPlayer.set(seg.playerId, seg.durationSec)
    }
  }

  const rpeEntries: RpeEntry[] = Object.entries(rpeByPlayerId)
    .filter(([, rpe]) => rpe > 0)
    .map(([playerId, rpe]) => {
      const durationSec =
        fullSessionDurationByPlayer.get(playerId) ??
        staged.segments.filter((s) => s.playerId === playerId).reduce((sum, s) => sum + s.durationSec, 0)
      return {
        id: `${session.id}:${playerId}`,
        sessionId: session.id,
        playerId,
        rpe,
        sRpe: rpe * (durationSec / 60),
        enteredAt: now,
      }
    })

  if (rpeEntries.length > 0) {
    await putRpeEntries(rpeEntries)
  }

  return session
}
