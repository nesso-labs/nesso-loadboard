import { json } from '../_lib/json'
import type { Env } from '../_lib/mappers'
import { DEFAULT_SETTINGS } from '../../src/lib/metrics/settings'
import type { AppSettings } from '../../src/types/domain'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const row = await env.DB.prepare('SELECT data FROM settings WHERE id = ?').bind('app-settings').first<{ data: string }>()
  if (!row) {
    await env.DB.prepare('INSERT INTO settings (id, data) VALUES (?, ?)').bind('app-settings', JSON.stringify(DEFAULT_SETTINGS)).run()
    return json(DEFAULT_SETTINGS)
  }
  return json(JSON.parse(row.data))
}

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const settings = (await request.json()) as AppSettings
  await env.DB.prepare('INSERT INTO settings (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data')
    .bind('app-settings', JSON.stringify(settings))
    .run()
  return json(settings)
}
