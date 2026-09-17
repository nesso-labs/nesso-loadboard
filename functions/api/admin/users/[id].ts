import type { AppData, Role } from '../../../_lib/auth'
import { badRequest, json, notFound } from '../../../_lib/json'
import type { Env } from '../../../_lib/mappers'
import { hashPassword } from '../../../_lib/passwords'

export const onRequestPatch: PagesFunction<Env, string, AppData> = async ({ request, env, params, data }) => {
  const id = params.id as string
  const body = (await request.json()) as {
    role?: Role
    active?: boolean
    newPassword?: string
    workspaceOwnerId?: string | null
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first<{ id: string }>()
  if (!existing) return notFound('utente non trovato')

  if (id === data.auth.userId && body.active === false) {
    return badRequest('non puoi disattivare il tuo stesso account')
  }
  if (id === data.auth.userId && body.role !== undefined && body.role !== 'admin') {
    return badRequest('non puoi cambiare il ruolo del tuo stesso account')
  }

  if (body.workspaceOwnerId) {
    const owner = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND role = 'editor'")
      .bind(body.workspaceOwnerId)
      .first()
    if (!owner) return badRequest('editor non trovato')
  }

  const sets: string[] = []
  const values: unknown[] = []

  if (body.role !== undefined) {
    if (body.role !== 'viewer' && body.role !== 'editor' && body.role !== 'admin') return badRequest('ruolo non valido')
    sets.push('role = ?')
    values.push(body.role)
  }
  if (body.active !== undefined) {
    sets.push('active = ?')
    values.push(body.active ? 1 : 0)
  }
  if (body.workspaceOwnerId !== undefined) {
    sets.push('workspace_owner_id = ?')
    values.push(body.workspaceOwnerId)
  }
  if (body.newPassword !== undefined) {
    if (body.newPassword.length < 8) return badRequest('la nuova password deve avere almeno 8 caratteri')
    sets.push('password_hash = ?')
    values.push(await hashPassword(body.newPassword))
  }

  if (sets.length === 0) return badRequest('nessuna modifica specificata')

  sets.push('updated_at = ?')
  values.push(new Date().toISOString(), id)

  await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  const updated = await env.DB.prepare(
    'SELECT id, email, role, workspace_owner_id, active, created_at FROM users WHERE id = ?',
  )
    .bind(id)
    .first<Record<string, unknown>>()

  return json({
    id: updated!.id,
    email: updated!.email,
    role: updated!.role,
    workspaceOwnerId: updated!.workspace_owner_id,
    active: Boolean(updated!.active),
    createdAt: updated!.created_at,
  })
}
