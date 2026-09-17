import type { AppData } from '../_lib/auth'
import { json } from '../_lib/json'
import { type Env, rowToSegment } from '../_lib/mappers'

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')
  const playerId = url.searchParams.get('playerId')
  const workspaceId = data.auth.workspaceId

  let stmt
  if (sessionId) {
    stmt = env.DB.prepare('SELECT * FROM segments WHERE session_id = ? AND workspace_id = ?').bind(sessionId, workspaceId)
  } else if (playerId) {
    stmt = env.DB.prepare('SELECT * FROM segments WHERE player_id = ? AND workspace_id = ?').bind(playerId, workspaceId)
  } else {
    stmt = env.DB.prepare('SELECT * FROM segments WHERE workspace_id = ?').bind(workspaceId)
  }

  const { results } = await stmt.all()
  return json((results as Record<string, unknown>[]).map(rowToSegment))
}
