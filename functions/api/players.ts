import { json } from '../_lib/json'
import { type Env, rowToPlayer } from '../_lib/mappers'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT * FROM players ORDER BY display_name').all()
  return json((results as Record<string, unknown>[]).map(rowToPlayer))
}
