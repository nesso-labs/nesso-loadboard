import { badRequest, json } from '../../_lib/json'
import { type Env, rpeToRow } from '../../_lib/mappers'
import type { RpeEntry } from '../../../src/types/domain'

const UPSERT_SQL = `
  INSERT INTO rpe (id, session_id, player_id, rpe, s_rpe, entered_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET rpe = excluded.rpe, s_rpe = excluded.s_rpe, entered_at = excluded.entered_at
`

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const entries = (await request.json()) as RpeEntry[]
  if (!Array.isArray(entries) || entries.length === 0) return badRequest('expected a non-empty array of rpe entries')

  const stmt = env.DB.prepare(UPSERT_SQL)
  const batch = entries.map((e) => stmt.bind(...rpeToRow(e)))
  await env.DB.batch(batch)

  return json({ inserted: entries.length }, { status: 201 })
}
