import { json, notFound } from '../../_lib/json'
import type { Env } from '../../_lib/mappers'

/** Deletes a session and cascades to its segments and RPE entries — D1 has no FK cascade configured. */
export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const id = params.id as string

  const existing = await env.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind(id).first<{ id: string }>()
  if (!existing) return notFound('session not found')

  await env.DB.batch([
    env.DB.prepare('DELETE FROM segments WHERE session_id = ?').bind(id),
    env.DB.prepare('DELETE FROM rpe WHERE session_id = ?').bind(id),
    env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id),
  ])

  return json({ deleted: id })
}
