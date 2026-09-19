import type { AppData } from '../../_lib/auth'
import { json } from '../../_lib/json'
import { type Env, rowToSegment } from '../../_lib/mappers'
import type { Session } from '../../../src/types/domain'

interface LinkRow {
  player_a_workspace_id: string
  player_a_id: string
  player_b_workspace_id: string
  player_b_id: string
}

/**
 * For every accepted link touching the caller's workspace, returns the OTHER
 * side's sessions (stripped to the fields the microcycle/match-boundary logic
 * actually reads — never labels, opponents, notes) plus that player's own
 * segments (re-tagged to the caller's own player id, so the existing
 * per-player computations just work once merged client-side). Team-wide
 * pages never call this — only single-player views should feed it in.
 */
export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const workspaceId = data.auth.workspaceId as string

  const { results: links } = await env.DB.prepare(
    `SELECT player_a_workspace_id, player_a_id, player_b_workspace_id, player_b_id
     FROM player_links WHERE status = 'accepted' AND (player_a_workspace_id = ? OR player_b_workspace_id = ?)`,
  )
    .bind(workspaceId, workspaceId)
    .all<LinkRow>()

  const out = []
  for (const link of links) {
    const mine = link.player_a_workspace_id === workspaceId
    const myPlayerId = mine ? link.player_a_id : link.player_b_id
    const otherWorkspaceId = mine ? link.player_b_workspace_id : link.player_a_workspace_id
    const otherPlayerId = mine ? link.player_b_id : link.player_a_id

    const otherPlayer = await env.DB.prepare('SELECT display_name FROM players WHERE id = ? AND workspace_id = ?')
      .bind(otherPlayerId, otherWorkspaceId)
      .first<{ display_name: string }>()

    const { results: sessionRows } = await env.DB.prepare(
      'SELECT id, date, type, training_type FROM sessions WHERE workspace_id = ?',
    )
      .bind(otherWorkspaceId)
      .all<Record<string, unknown>>()

    const sessions: Session[] = sessionRows.map((r) => ({
      id: r.id as string,
      date: r.date as string,
      // Never the real label/opponent from the other workspace — only date/type/trainingType are needed
      // by the microcycle/match-boundary logic. Training rows re-derive their own label from
      // date+trainingType client-side; this generic placeholder only ever surfaces for match rows.
      label: r.type === 'match' ? 'Partita (altro spazio)' : '',
      type: r.type as Session['type'],
      trainingType: (r.training_type as Session['trainingType']) ?? undefined,
      importedAt: '',
      rawRowCount: 0,
      warningCount: 0,
    }))

    const { results: segRows } = await env.DB.prepare('SELECT * FROM segments WHERE workspace_id = ? AND player_id = ?')
      .bind(otherWorkspaceId, otherPlayerId)
      .all<Record<string, unknown>>()

    const segments = segRows.map((r) => ({ ...rowToSegment(r), playerId: myPlayerId }))

    out.push({ myPlayerId, otherPlayerName: otherPlayer?.display_name ?? otherPlayerId, sessions, segments })
  }

  return json(out)
}
