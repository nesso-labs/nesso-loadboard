import type { AppData, Role } from '../../_lib/auth'
import { badRequest, json } from '../../_lib/json'
import type { Env } from '../../_lib/mappers'
import { hashPassword } from '../../_lib/passwords'

interface UserRow {
  id: string
  email: string
  role: Role
  workspace_owner_id: string | null
  active: number
  created_at: string
  last_login_at: string | null
}

function toApiUser(r: UserRow) {
  return {
    id: r.id,
    email: r.email,
    role: r.role,
    workspaceOwnerId: r.workspace_owner_id,
    active: Boolean(r.active),
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  }
}

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.email, u.role, u.workspace_owner_id, u.active, u.created_at,
            (SELECT MAX(created_at) FROM login_audit WHERE user_id = u.id AND success = 1) as last_login_at
     FROM users u ORDER BY u.created_at ASC`,
  ).all<UserRow>()
  return json(results.map(toApiUser))
}

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env }) => {
  const body = (await request.json()) as {
    email?: string
    password?: string
    role?: Role
    workspaceOwnerId?: string | null
  }
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password
  const role = body?.role

  if (!email || !email.includes('@')) return badRequest('email non valida')
  if (!password || password.length < 8) return badRequest('la password deve avere almeno 8 caratteri')
  if (role !== 'viewer' && role !== 'editor' && role !== 'admin') return badRequest('ruolo non valido')

  let workspaceOwnerId: string | null = null
  if (role === 'viewer') {
    if (!body.workspaceOwnerId) return badRequest('un Viewer deve essere associato a un Editor o a un Admin')
    // Admins own a workspace too, so they are equally valid owners to bind to.
    const owner = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND role IN ('editor','admin')")
      .bind(body.workspaceOwnerId)
      .first()
    if (!owner) return badRequest('proprietario del workspace non trovato')
    workspaceOwnerId = body.workspaceOwnerId
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').bind(email).first()
  if (existing) return badRequest('esiste già un account con questa email')

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const passwordHash = await hashPassword(password)

  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, role, workspace_owner_id, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(id, email, passwordHash, role, workspaceOwnerId, now, now)
    .run()

  return json(
    toApiUser({ id, email, role, workspace_owner_id: workspaceOwnerId, active: 1, created_at: now, last_login_at: null }),
    { status: 201 },
  )
}
