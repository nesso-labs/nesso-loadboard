import { json } from '../../_lib/json'
import type { Env } from '../../_lib/mappers'

interface AuditRow {
  id: string
  user_id: string | null
  email_attempted: string
  success: number
  user_agent: string | null
  created_at: string
  user_email: string | null
}

/** Last 200 login attempts (or last 200 for one user, via ?userId=). Admin-only — enforced in _middleware.ts. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')

  const base = `SELECT a.id, a.user_id, a.email_attempted, a.success, a.user_agent, a.created_at, u.email as user_email
     FROM login_audit a LEFT JOIN users u ON u.id = a.user_id`

  const stmt = userId
    ? env.DB.prepare(`${base} WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT 200`).bind(userId)
    : env.DB.prepare(`${base} ORDER BY a.created_at DESC LIMIT 200`)

  const { results } = await stmt.all<AuditRow>()
  return json(
    results.map((r) => ({
      id: r.id,
      userId: r.user_id,
      email: r.user_email ?? r.email_attempted,
      success: Boolean(r.success),
      userAgent: r.user_agent,
      createdAt: r.created_at,
    })),
  )
}
