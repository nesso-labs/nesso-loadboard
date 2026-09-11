import type { AppSettings, DrillSegment, Player, RpeEntry, Session } from '../../types/domain'
import { slugifyName } from '../utils'
import { getDb } from './schema'

// ---------- sessions ----------

export async function listSessions(): Promise<Session[]> {
  const db = await getDb()
  const all = await db.getAll('sessions')
  return all.sort((a, b) => b.date.localeCompare(a.date))
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDb()
  return db.get('sessions', id)
}

export async function putSession(session: Session): Promise<void> {
  const db = await getDb()
  await db.put('sessions', session)
}

// ---------- players ----------

export async function listPlayers(): Promise<Player[]> {
  const db = await getDb()
  const all = await db.getAll('players')
  return all.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function getPlayer(id: string): Promise<Player | undefined> {
  const db = await getDb()
  return db.get('players', id)
}

export async function putPlayer(player: Player): Promise<void> {
  const db = await getDb()
  await db.put('players', player)
}

/** Find-or-create a player by display name, returning the (possibly new) player. */
export async function upsertPlayerByName(displayName: string): Promise<Player> {
  const db = await getDb()
  const id = slugifyName(displayName)
  const existing = await db.get('players', id)
  const now = new Date().toISOString()
  if (existing) {
    if (existing.displayName !== displayName) {
      const updated = { ...existing, displayName, updatedAt: now }
      await db.put('players', updated)
      return updated
    }
    return existing
  }
  const created: Player = {
    id,
    displayName,
    position: 'UNSPECIFIED',
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  await db.put('players', created)
  return created
}

// ---------- segments ----------

export async function listSegmentsBySession(sessionId: string): Promise<DrillSegment[]> {
  const db = await getDb()
  return db.getAllFromIndex('segments', 'by-sessionId', sessionId)
}

export async function listSegmentsByPlayer(playerId: string): Promise<DrillSegment[]> {
  const db = await getDb()
  return db.getAllFromIndex('segments', 'by-playerId', playerId)
}

export async function listAllSegments(): Promise<DrillSegment[]> {
  const db = await getDb()
  return db.getAll('segments')
}

export async function putSegments(segments: DrillSegment[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('segments', 'readwrite')
  await Promise.all(segments.map((s) => tx.store.put(s)))
  await tx.done
}

// ---------- rpe ----------

export async function listRpeBySession(sessionId: string): Promise<RpeEntry[]> {
  const db = await getDb()
  return db.getAllFromIndex('rpe', 'by-sessionId', sessionId)
}

export async function listAllRpe(): Promise<RpeEntry[]> {
  const db = await getDb()
  return db.getAll('rpe')
}

export async function putRpeEntry(entry: RpeEntry): Promise<void> {
  const db = await getDb()
  await db.put('rpe', entry)
}

export async function putRpeEntries(entries: RpeEntry[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('rpe', 'readwrite')
  await Promise.all(entries.map((e) => tx.store.put(e)))
  await tx.done
}

// ---------- settings ----------

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb()
  const settings = await db.get('settings', 'app-settings')
  if (!settings) throw new Error('settings not initialized — getDb() should seed defaults')
  return settings
}

export async function putSettings(settings: AppSettings): Promise<void> {
  const db = await getDb()
  await db.put('settings', settings)
}

// ---------- aggregate helpers ----------

/** Everything needed to render a session's dashboard, in one round trip. */
export async function loadSessionBundle(sessionId: string) {
  const [session, segments, rpe] = await Promise.all([
    getSession(sessionId),
    listSegmentsBySession(sessionId),
    listRpeBySession(sessionId),
  ])
  return { session, segments, rpe }
}
