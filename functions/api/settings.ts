import type { AppData } from '../_lib/auth'
import { json } from '../_lib/json'
import type { Env } from '../_lib/mappers'
import { DEFAULT_SETTINGS } from '../../src/lib/metrics/settings'
import type { AppSettings } from '../../src/types/domain'

/** One settings row per workspace, keyed by the workspace's own id. */
export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const workspaceId = data.auth.workspaceId as string
  const row = await env.DB.prepare('SELECT data FROM settings WHERE id = ?').bind(workspaceId).first<{ data: string }>()
  if (!row) {
    await env.DB.prepare('INSERT INTO settings (id, data) VALUES (?, ?)').bind(workspaceId, JSON.stringify(DEFAULT_SETTINGS)).run()
    return json(DEFAULT_SETTINGS)
  }
  return json(JSON.parse(row.data))
}

export const onRequestPut: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const settings = (await request.json()) as AppSettings
  const workspaceId = data.auth.workspaceId as string
  await env.DB.prepare('INSERT INTO settings (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data')
    .bind(workspaceId, JSON.stringify(settings))
    .run()
  return json(settings)
}
