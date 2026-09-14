import { badRequest, json } from '../../_lib/json'
import { type Env, playerToRow, rowToPlayer } from '../../_lib/mappers'
import type { Player } from '../../../src/types/domain'

function slugifyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json()) as { displayName?: string }
  const displayName = body?.displayName?.trim()
  if (!displayName) return badRequest('displayName is required')

  const id = slugifyName(displayName)
  const now = new Date().toISOString()
  const existing = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<Record<string, unknown>>()

  if (existing) {
    if (existing.display_name !== displayName) {
      const updated: Player = { ...rowToPlayer(existing), displayName, updatedAt: now }
      await env.DB.prepare(
        'UPDATE players SET display_name = ?, updated_at = ? WHERE id = ?',
      )
        .bind(displayName, now, id)
        .run()
      return json(updated)
    }
    return json(rowToPlayer(existing))
  }

  const created: Player = {
    id,
    displayName,
    position: 'UNSPECIFIED',
    pbConfirmed: false,
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  await env.DB.prepare(
    `INSERT INTO players (id, display_name, position, height_cm, weight_kg, personal_max_speed_kmh, pb_confirmed, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(...playerToRow(created))
    .run()

  return json(created, { status: 201 })
}
