import type { AppSettings, DrillSegment, Player, RpeEntry, Session } from '../../types/domain'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status} ${body}`)
  }
  return res.json() as Promise<T>
}

// ---------- sessions ----------

export async function listSessions(): Promise<Session[]> {
  return apiFetch<Session[]>('/api/sessions')
}

export async function putSession(session: Session): Promise<void> {
  await apiFetch('/api/sessions', { method: 'POST', body: JSON.stringify(session) })
}

// ---------- players ----------

export async function listPlayers(): Promise<Player[]> {
  return apiFetch<Player[]>('/api/players')
}

export async function putPlayer(player: Player): Promise<void> {
  await apiFetch(`/api/players/${player.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ position: player.position, active: player.active, personalMaxSpeedKmh: player.personalMaxSpeedKmh }),
  })
}

/** Find-or-create a player by display name, returning the (possibly new) player. */
export async function upsertPlayerByName(displayName: string): Promise<Player> {
  return apiFetch<Player>('/api/players/upsert', { method: 'POST', body: JSON.stringify({ displayName }) })
}

// ---------- segments ----------

export async function listSegmentsBySession(sessionId: string): Promise<DrillSegment[]> {
  return apiFetch<DrillSegment[]>(`/api/segments?sessionId=${encodeURIComponent(sessionId)}`)
}

export async function listSegmentsByPlayer(playerId: string): Promise<DrillSegment[]> {
  return apiFetch<DrillSegment[]>(`/api/segments?playerId=${encodeURIComponent(playerId)}`)
}

export async function listAllSegments(): Promise<DrillSegment[]> {
  return apiFetch<DrillSegment[]>('/api/segments')
}

export async function putSegments(segments: DrillSegment[]): Promise<void> {
  if (segments.length === 0) return
  await apiFetch('/api/segments/bulk', { method: 'POST', body: JSON.stringify(segments) })
}

// ---------- rpe ----------

export async function listRpeBySession(sessionId: string): Promise<RpeEntry[]> {
  return apiFetch<RpeEntry[]>(`/api/rpe?sessionId=${encodeURIComponent(sessionId)}`)
}

export async function listAllRpe(): Promise<RpeEntry[]> {
  return apiFetch<RpeEntry[]>('/api/rpe')
}

export async function putRpeEntries(entries: RpeEntry[]): Promise<void> {
  if (entries.length === 0) return
  await apiFetch('/api/rpe/bulk', { method: 'POST', body: JSON.stringify(entries) })
}

// ---------- settings ----------

export async function getSettings(): Promise<AppSettings> {
  return apiFetch<AppSettings>('/api/settings')
}

export async function putSettings(settings: AppSettings): Promise<void> {
  await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(settings) })
}
