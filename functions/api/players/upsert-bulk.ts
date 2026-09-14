import { badRequest, json } from '../../_lib/json'
import { type Env, playerToRow, rowToPlayer } from '../../_lib/mappers'
import type { Player } from '../../../src/types/domain'

function slugifyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

/**
 * Find-or-create every player in `displayNames` in ONE round trip instead of
 * one request per player — an import with a full squad was doing 20+
 * sequential upserts against D1 (each a SELECT, some an INSERT/UPDATE too),
 * which serializes badly. One SELECT ... IN (...) plus one batched write.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json()) as { displayNames?: string[] }
  const names = [...new Set((body?.displayNames ?? []).map((n) => n?.trim()).filter((n): n is string => !!n))]
  if (names.length === 0) return badRequest('displayNames must be a non-empty array')

  const now = new Date().toISOString()
  const idByName = new Map(names.map((n) => [n, slugifyName(n)]))
  const ids = [...idByName.values()]

  const placeholders = ids.map(() => '?').join(',')
  const { results } = await env.DB.prepare(`SELECT * FROM players WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<Record<string, unknown>>()
  const existingById = new Map(results.map((r) => [r.id as string, rowToPlayer(r)]))

  const writes: D1PreparedStatement[] = []
  const out: Player[] = []

  for (const name of names) {
    const id = idByName.get(name)!
    const existing = existingById.get(id)
    if (existing) {
      if (existing.displayName !== name) {
        const updated: Player = { ...existing, displayName: name, updatedAt: now }
        writes.push(env.DB.prepare('UPDATE players SET display_name = ?, updated_at = ? WHERE id = ?').bind(name, now, id))
        out.push(updated)
      } else {
        out.push(existing)
      }
      continue
    }

    const created: Player = {
      id,
      displayName: name,
      position: 'UNSPECIFIED',
      pbConfirmed: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    }
    writes.push(
      env.DB.prepare(
        `INSERT INTO players (id, display_name, position, personal_max_speed_kmh, pb_confirmed, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(...playerToRow(created)),
    )
    out.push(created)
  }

  if (writes.length > 0) await env.DB.batch(writes)

  return json(out, { status: 201 })
}
