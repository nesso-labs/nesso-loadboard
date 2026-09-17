import type { AppData } from '../_lib/auth'
import { json } from '../_lib/json'
import { type Env, rowToRpe } from '../_lib/mappers'

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')
  const workspaceId = data.auth.workspaceId

  const stmt = sessionId
    ? env.DB.prepare('SELECT * FROM rpe WHERE session_id = ? AND workspace_id = ?').bind(sessionId, workspaceId)
    : env.DB.prepare('SELECT * FROM rpe WHERE workspace_id = ?').bind(workspaceId)

  const { results } = await stmt.all()
  return json((results as Record<string, unknown>[]).map(rowToRpe))
}
