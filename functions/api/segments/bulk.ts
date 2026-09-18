import type { AppData } from '../../_lib/auth'
import { badRequest, json } from '../../_lib/json'
import { type Env, segmentToRow } from '../../_lib/mappers'
import { ensureColumns } from '../../_lib/schema'
import type { DrillSegment } from '../../../src/types/domain'

const UPSERT_SQL = `
  INSERT INTO segments (
    id, workspace_id, session_id, player_id, drill_title, segment_kind, duration_sec, total_distance_m,
    distance_per_min, distance_zone4_m, distance_zone5_m, distance_zone6_m, entries_zone5,
    entries_zone6, hsr_m, hsr_per_min, max_speed_kmh, pct_max_speed, acc_zone3, dec_zone3,
    acc_zone4, dec_zone4, acc_zone5, dec_zone5, acc_zone6, dec_zone6, acc_per_min, dec_per_min,
    dropped_duplicates, warnings, is_synthesized_full_session, is_rehab
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    drill_title = excluded.drill_title, segment_kind = excluded.segment_kind,
    duration_sec = excluded.duration_sec, total_distance_m = excluded.total_distance_m,
    distance_per_min = excluded.distance_per_min, distance_zone4_m = excluded.distance_zone4_m,
    distance_zone5_m = excluded.distance_zone5_m, distance_zone6_m = excluded.distance_zone6_m,
    entries_zone5 = excluded.entries_zone5, entries_zone6 = excluded.entries_zone6,
    hsr_m = excluded.hsr_m, hsr_per_min = excluded.hsr_per_min, max_speed_kmh = excluded.max_speed_kmh,
    pct_max_speed = excluded.pct_max_speed, acc_zone3 = excluded.acc_zone3, dec_zone3 = excluded.dec_zone3,
    acc_zone4 = excluded.acc_zone4, dec_zone4 = excluded.dec_zone4, acc_zone5 = excluded.acc_zone5,
    dec_zone5 = excluded.dec_zone5, acc_zone6 = excluded.acc_zone6, dec_zone6 = excluded.dec_zone6,
    acc_per_min = excluded.acc_per_min, dec_per_min = excluded.dec_per_min,
    dropped_duplicates = excluded.dropped_duplicates, warnings = excluded.warnings,
    is_synthesized_full_session = excluded.is_synthesized_full_session, is_rehab = excluded.is_rehab
  WHERE segments.workspace_id = excluded.workspace_id
`

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const segments = (await request.json()) as DrillSegment[]
  if (!Array.isArray(segments) || segments.length === 0) return badRequest('expected a non-empty array of segments')

  await ensureColumns(env, 'segments', [
    { name: 'workspace_id', type: 'TEXT' },
    { name: 'is_rehab', type: 'INTEGER NOT NULL DEFAULT 0' },
  ])

  const workspaceId = data.auth.workspaceId
  const stmt = env.DB.prepare(UPSERT_SQL)
  const batch = segments.map((s) => {
    const row = segmentToRow(s)
    return stmt.bind(row[0], workspaceId, ...row.slice(1))
  })
  await env.DB.batch(batch)

  return json({ inserted: segments.length }, { status: 201 })
}
