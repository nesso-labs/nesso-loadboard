import { badRequest, json } from '../../_lib/json'
import { type Env, rowToPlayer } from '../../_lib/mappers'
import type { Player } from '../../../src/types/domain'

interface PlayerPatch {
  id: string
  position?: Player['position']
  active?: boolean
  personalMaxSpeedKmh?: number
  pbConfirmed?: boolean
}

/**
 * Patch several players in ONE round trip — used after importing a session,
 * when every player who set a new personal best used to trigger its own
 * sequential PATCH request (a match session, with faster sprints than
 * training, routinely updates far more players at once than a training
 * session does, which is what made match imports feel especially slow).
 */
export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const patches = (await request.json()) as PlayerPatch[]
  if (!Array.isArray(patches) || patches.length === 0) return badRequest('expected a non-empty array of player patches')

  const ids = patches.map((p) => p.id)
  const placeholders = ids.map(() => '?').join(',')
  const { results } = await env.DB.prepare(`SELECT * FROM players WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<Record<string, unknown>>()
  const existingById = new Map(results.map((r) => [r.id as string, rowToPlayer(r)]))

  const now = new Date().toISOString()
  const writes: D1PreparedStatement[] = []
  const out: Player[] = []

  for (const patch of patches) {
    const current = existingById.get(patch.id)
    if (!current) continue
    const updated: Player = { ...current, ...patch, id: current.id, updatedAt: now }
    writes.push(
      env.DB.prepare(
        'UPDATE players SET position = ?, personal_max_speed_kmh = ?, pb_confirmed = ?, active = ?, updated_at = ? WHERE id = ?',
      ).bind(
        updated.position,
        updated.personalMaxSpeedKmh ?? null,
        updated.pbConfirmed ? 1 : 0,
        updated.active ? 1 : 0,
        updated.updatedAt,
        patch.id,
      ),
    )
    out.push(updated)
  }

  if (writes.length > 0) await env.DB.batch(writes)

  return json(out)
}
