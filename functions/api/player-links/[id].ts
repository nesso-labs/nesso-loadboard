import type { AppData } from '../../_lib/auth'
import { badRequest, forbidden, json, notFound } from '../../_lib/json'
import type { Env } from '../../_lib/mappers'

interface LinkRow {
  id: string
  player_a_workspace_id: string
  player_b_workspace_id: string
  status: string
  proposed_by_user_id: string
}

/** Only the recipient (the side that did NOT propose it) can accept or reject — the proposer just waits or cancels via DELETE. */
export const onRequestPatch: PagesFunction<Env, string, AppData> = async ({ request, env, params, data }) => {
  const id = params.id as string
  const workspaceId = data.auth.workspaceId as string
  const body = (await request.json()) as { status?: 'accepted' | 'rejected' }
  if (body?.status !== 'accepted' && body?.status !== 'rejected') return badRequest('status deve essere "accepted" o "rejected"')

  const link = await env.DB.prepare('SELECT * FROM player_links WHERE id = ?').bind(id).first<LinkRow>()
  if (!link) return notFound('collegamento non trovato')
  if (link.player_a_workspace_id !== workspaceId && link.player_b_workspace_id !== workspaceId) return notFound('collegamento non trovato')
  if (link.status !== 'pending') return badRequest('questo collegamento non è più in sospeso')
  if (link.proposed_by_user_id === data.auth.userId) return forbidden('non puoi accettare o rifiutare la tua stessa proposta')

  const now = new Date().toISOString()
  await env.DB.prepare('UPDATE player_links SET status = ?, updated_at = ? WHERE id = ?').bind(body.status, now, id).run()

  return json({ id, status: body.status })
}

/** Either side can remove a link at any time — cancels a pending proposal or ends an accepted one. */
export const onRequestDelete: PagesFunction<Env, string, AppData> = async ({ env, params, data }) => {
  const id = params.id as string
  const workspaceId = data.auth.workspaceId as string

  const link = await env.DB.prepare('SELECT * FROM player_links WHERE id = ?').bind(id).first<LinkRow>()
  if (!link) return notFound('collegamento non trovato')
  if (link.player_a_workspace_id !== workspaceId && link.player_b_workspace_id !== workspaceId) return notFound('collegamento non trovato')

  await env.DB.prepare('DELETE FROM player_links WHERE id = ?').bind(id).run()
  return json({ deleted: id })
}
