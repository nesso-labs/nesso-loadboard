import { json } from '../_lib/json'
import { type Env, rowToSegment } from '../_lib/mappers'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')
  const playerId = url.searchParams.get('playerId')

  let stmt
  if (sessionId) {
    stmt = env.DB.prepare('SELECT * FROM segments WHERE session_id = ?').bind(sessionId)
  } else if (playerId) {
    stmt = env.DB.prepare('SELECT * FROM segments WHERE player_id = ?').bind(playerId)
  } else {
    stmt = env.DB.prepare('SELECT * FROM segments')
  }

  const { results } = await stmt.all()
  return json((results as Record<string, unknown>[]).map(rowToSegment))
}
