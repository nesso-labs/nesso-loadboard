import type { AppData } from '../../_lib/auth'
import { badRequest, json } from '../../_lib/json'
import type { Env } from '../../_lib/mappers'
import { hashPassword, verifyPassword } from '../../_lib/passwords'

/** Self-service password change — any signed-in user, own account only. */
export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const body = (await request.json()) as { currentPassword?: string; newPassword?: string }
  const currentPassword = body?.currentPassword ?? ''
  const newPassword = body?.newPassword ?? ''
  if (newPassword.length < 8) return badRequest('la nuova password deve avere almeno 8 caratteri')

  const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(data.auth.userId)
    .first<{ password_hash: string }>()
  if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
    return badRequest('password attuale errata')
  }

  const newHash = await hashPassword(newPassword)
  await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(newHash, new Date().toISOString(), data.auth.userId)
    .run()

  return json({ ok: true })
}
