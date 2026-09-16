import { badRequest, json } from '../_lib/json'
import { type Env, rowToSession, sessionToRow } from '../_lib/mappers'
import { ensureColumns } from '../_lib/schema'
import type { Session } from '../../src/types/domain'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT * FROM sessions ORDER BY date DESC').all()
  return json((results as Record<string, unknown>[]).map(rowToSession))
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = (await request.json()) as Session
  if (!session?.id || !session.date) return badRequest('session id and date are required')

  await ensureColumns(env, 'sessions', [
    { name: 'training_type', type: 'TEXT' },
    { name: 'match_result', type: 'TEXT' },
    { name: 'match_location', type: 'TEXT' },
    { name: 'opponent_name', type: 'TEXT' },
  ])

  await env.DB.prepare(
    `INSERT INTO sessions (id, date, label, type, training_type, match_result, match_location, opponent_name, imported_at, source_file_name, raw_row_count, warning_count, notes, reconciliation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       date = excluded.date, label = excluded.label, type = excluded.type, training_type = excluded.training_type,
       match_result = excluded.match_result, match_location = excluded.match_location, opponent_name = excluded.opponent_name,
       imported_at = excluded.imported_at, source_file_name = excluded.source_file_name,
       raw_row_count = excluded.raw_row_count, warning_count = excluded.warning_count, notes = excluded.notes,
       reconciliation = excluded.reconciliation`,
  )
    .bind(...sessionToRow(session))
    .run()

  return json(session, { status: 201 })
}
