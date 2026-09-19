import type { AppData } from '../_lib/auth'
import { badRequest, json } from '../_lib/json'
import type { Env } from '../_lib/mappers'

interface LinkRow {
  id: string
  player_a_workspace_id: string
  player_a_id: string
  player_b_workspace_id: string
  player_b_id: string
  status: string
  proposed_by_user_id: string
  created_at: string
  updated_at: string
}

async function formatLink(env: Env, workspaceId: string, userId: string, row: LinkRow) {
  const mine = row.player_a_workspace_id === workspaceId
  const myPlayerId = mine ? row.player_a_id : row.player_b_id
  const otherWorkspaceId = mine ? row.player_b_workspace_id : row.player_a_workspace_id
  const otherPlayerId = mine ? row.player_b_id : row.player_a_id

  const [myPlayer, otherPlayer, otherEditor] = await Promise.all([
    env.DB.prepare('SELECT display_name FROM players WHERE id = ? AND workspace_id = ?')
      .bind(myPlayerId, workspaceId)
      .first<{ display_name: string }>(),
    env.DB.prepare('SELECT display_name FROM players WHERE id = ? AND workspace_id = ?')
      .bind(otherPlayerId, otherWorkspaceId)
      .first<{ display_name: string }>(),
    env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(otherWorkspaceId).first<{ email: string }>(),
  ])

  return {
    id: row.id,
    status: row.status,
    proposedByMe: row.proposed_by_user_id === userId,
    myPlayerId,
    myPlayerName: myPlayer?.display_name ?? myPlayerId,
    otherEditorEmail: otherEditor?.email ?? '—',
    otherPlayerName: otherPlayer?.display_name ?? otherPlayerId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const workspaceId = data.auth.workspaceId as string
  const { results } = await env.DB.prepare(
    `SELECT * FROM player_links
     WHERE status != 'rejected' AND (player_a_workspace_id = ? OR player_b_workspace_id = ?)
     ORDER BY created_at DESC`,
  )
    .bind(workspaceId, workspaceId)
    .all<LinkRow>()

  const links = await Promise.all(results.map((row) => formatLink(env, workspaceId, data.auth.userId, row)))
  return json(links)
}

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const workspaceId = data.auth.workspaceId as string
  const body = (await request.json()) as { myPlayerId?: string; targetEditorEmail?: string; targetPlayerName?: string }

  const myPlayerId = body?.myPlayerId?.trim()
  const targetEmail = body?.targetEditorEmail?.trim().toLowerCase()
  const targetName = body?.targetPlayerName?.trim()
  if (!myPlayerId || !targetEmail || !targetName) {
    return badRequest('myPlayerId, targetEditorEmail e targetPlayerName sono obbligatori')
  }

  const myPlayer = await env.DB.prepare('SELECT id FROM players WHERE id = ? AND workspace_id = ?')
    .bind(myPlayerId, workspaceId)
    .first()
  if (!myPlayer) return badRequest('giocatore non trovato nel tuo spazio')

  const targetUser = await env.DB.prepare(
    "SELECT id FROM users WHERE email = ? COLLATE NOCASE AND role IN ('editor','admin') AND active = 1",
  )
    .bind(targetEmail)
    .first<{ id: string }>()
  if (!targetUser) return badRequest('nessun Editor/Admin attivo trovato con questa email')
  if (targetUser.id === workspaceId) return badRequest('non puoi collegare un giocatore al tuo stesso spazio')

  const candidates = await env.DB.prepare('SELECT id, display_name FROM players WHERE workspace_id = ? AND display_name = ? COLLATE NOCASE')
    .bind(targetUser.id, targetName)
    .all<{ id: string; display_name: string }>()
  if (candidates.results.length === 0) {
    return badRequest('nessun giocatore con questo nome esatto nello spazio indicato — controlla l\'ortografia')
  }
  if (candidates.results.length > 1) {
    return badRequest('più giocatori con questo nome nello spazio indicato — non è possibile determinare quale collegare')
  }
  const targetPlayerId = candidates.results[0].id

  const existing = await env.DB.prepare(
    `SELECT id FROM player_links WHERE status != 'rejected' AND (
       (player_a_workspace_id = ? AND player_a_id = ? AND player_b_workspace_id = ? AND player_b_id = ?) OR
       (player_a_workspace_id = ? AND player_a_id = ? AND player_b_workspace_id = ? AND player_b_id = ?)
     )`,
  )
    .bind(workspaceId, myPlayerId, targetUser.id, targetPlayerId, targetUser.id, targetPlayerId, workspaceId, myPlayerId)
    .first()
  if (existing) return badRequest('esiste già un collegamento (in sospeso o attivo) tra questi due giocatori')

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await env.DB.prepare(
    `INSERT INTO player_links
       (id, player_a_workspace_id, player_a_id, player_b_workspace_id, player_b_id, status, proposed_by_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
  )
    .bind(id, workspaceId, myPlayerId, targetUser.id, targetPlayerId, data.auth.userId, now, now)
    .run()

  const row = await env.DB.prepare('SELECT * FROM player_links WHERE id = ?').bind(id).first<LinkRow>()
  return json(await formatLink(env, workspaceId, data.auth.userId, row!), { status: 201 })
}
