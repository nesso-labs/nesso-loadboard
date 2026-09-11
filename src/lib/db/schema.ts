import { type DBSchema, type IDBPDatabase, openDB } from 'idb'
import type { AppSettings, DrillSegment, Player, RpeEntry, Session } from '../../types/domain'
import { DEFAULT_SETTINGS } from '../metrics/settings'

const DB_NAME = 'preparatore-atletico'
const DB_VERSION = 1

interface LoadBoardDB extends DBSchema {
  sessions: {
    key: string
    value: Session
    indexes: { 'by-date': string; 'by-type': string }
  }
  players: {
    key: string
    value: Player
    indexes: { 'by-displayName': string }
  }
  segments: {
    key: string
    value: DrillSegment
    indexes: {
      'by-sessionId': string
      'by-playerId': string
      'by-session-player': [string, string]
      'by-session-kind': [string, string]
    }
  }
  rpe: {
    key: string
    value: RpeEntry
    indexes: { 'by-sessionId': string; 'by-playerId': string }
  }
  settings: {
    key: string
    value: AppSettings
  }
}

let dbPromise: Promise<IDBPDatabase<LoadBoardDB>> | null = null

export function getDb(): Promise<IDBPDatabase<LoadBoardDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LoadBoardDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' })
        sessions.createIndex('by-date', 'date')
        sessions.createIndex('by-type', 'type')

        const players = db.createObjectStore('players', { keyPath: 'id' })
        players.createIndex('by-displayName', 'displayName')

        const segments = db.createObjectStore('segments', { keyPath: 'id' })
        segments.createIndex('by-sessionId', 'sessionId')
        segments.createIndex('by-playerId', 'playerId')
        segments.createIndex('by-session-player', ['sessionId', 'playerId'])
        segments.createIndex('by-session-kind', ['sessionId', 'segmentKind'])

        const rpe = db.createObjectStore('rpe', { keyPath: 'id' })
        rpe.createIndex('by-sessionId', 'sessionId')
        rpe.createIndex('by-playerId', 'playerId')

        db.createObjectStore('settings', { keyPath: 'id' })
      },
    }).then(async (db) => {
      const existing = await db.get('settings', 'app-settings')
      if (!existing) {
        await db.put('settings', DEFAULT_SETTINGS)
      }
      return db
    })
  }
  return dbPromise
}

export type { LoadBoardDB }
