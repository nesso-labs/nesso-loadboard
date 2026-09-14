import { badRequest, json, notFound } from '../../_lib/json'
import { type Env, rowToPlayer } from '../../_lib/mappers'
import type { Player } from '../../../src/types/domain'

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = params.id as string
  const patch = (await request.json()) as Partial<Player>

  const existing = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<Record<string, unknown>>()
  if (!existing) return notFound('player not found')

  const current = rowToPlayer(existing)
  const updated: Player = { ...current, ...patch, id: current.id, updatedAt: new Date().toISOString() }

  if (
    patch.position === undefined &&
    patch.active === undefined &&
    patch.personalMaxSpeedKmh === undefined &&
    patch.pbConfirmed === undefined &&
    patch.heightCm === undefined &&
    patch.weightKg === undefined
  ) {
    return badRequest('nothing to update')
  }

  await env.DB.prepare(
    'UPDATE players SET position = ?, height_cm = ?, weight_kg = ?, personal_max_speed_kmh = ?, pb_confirmed = ?, active = ?, updated_at = ? WHERE id = ?',
  )
    .bind(
      updated.position,
      updated.heightCm ?? null,
      updated.weightKg ?? null,
      updated.personalMaxSpeedKmh ?? null,
      updated.pbConfirmed ? 1 : 0,
      updated.active ? 1 : 0,
      updated.updatedAt,
      id,
    )
    .run()

  return json(updated)
}
