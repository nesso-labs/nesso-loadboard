import { json } from '../_lib/json'
import { type Env, rowToRpe } from '../_lib/mappers'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')

  const stmt = sessionId
    ? env.DB.prepare('SELECT * FROM rpe WHERE session_id = ?').bind(sessionId)
    : env.DB.prepare('SELECT * FROM rpe')

  const { results } = await stmt.all()
  return json((results as Record<string, unknown>[]).map(rowToRpe))
}
