import { badRequest, json, notFound } from '../../_lib/json'
import { type Env, rowToPlayer } from '../../_lib/mappers'
import { ensureColumns } from '../../_lib/schema'
import type { Player } from '../../../src/types/domain'

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = params.id as string
  const patch = (await request.json()) as Partial<Player>

  const existing = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<Record<string, unknown>>()
  if (!existing) return notFound('player not found')

  const current = rowToPlayer(existing)
  const updated: Player = { ...current, ...patch, id: current.id, updatedAt: new Date().toISOString() }

  // Only reference columns the caller actually intends to change — never
  // unconditionally touch height_cm/weight_kg, so a caller that only ever
  // sends position/active/PB fields (e.g. the automatic new-personal-best
  // update that fires on nearly every import) can't be broken by those two
  // columns not existing yet on a database that hasn't run migration 0005.
  const sets: string[] = []
  const values: unknown[] = []
  if (patch.position !== undefined) {
    sets.push('position = ?')
    values.push(updated.position)
  }
  if (patch.heightCm !== undefined || patch.weightKg !== undefined) {
    await ensureColumns(env, 'players', [
      { name: 'height_cm', type: 'REAL' },
      { name: 'weight_kg', type: 'REAL' },
    ])
  }
  if (patch.heightCm !== undefined) {
    sets.push('height_cm = ?')
    values.push(updated.heightCm ?? null)
  }
  if (patch.weightKg !== undefined) {
    sets.push('weight_kg = ?')
    values.push(updated.weightKg ?? null)
  }
  if (patch.personalMaxSpeedKmh !== undefined) {
    sets.push('personal_max_speed_kmh = ?')
    values.push(updated.personalMaxSpeedKmh ?? null)
  }
  if (patch.pbConfirmed !== undefined) {
    sets.push('pb_confirmed = ?')
    values.push(updated.pbConfirmed ? 1 : 0)
  }
  if (patch.active !== undefined) {
    sets.push('active = ?')
    values.push(updated.active ? 1 : 0)
  }

  if (sets.length === 0) return badRequest('nothing to update')

  sets.push('updated_at = ?')
  values.push(updated.updatedAt, id)

  await env.DB.prepare(`UPDATE players SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  return json(updated)
}
