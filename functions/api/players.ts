import type { AppData } from '../_lib/auth'
import { json } from '../_lib/json'
import { type Env, rowToPlayer } from '../_lib/mappers'

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const { results } = await env.DB.prepare('SELECT * FROM players WHERE workspace_id = ? ORDER BY display_name')
    .bind(data.auth.workspaceId)
    .all()
  return json((results as Record<string, unknown>[]).map(rowToPlayer))
}
