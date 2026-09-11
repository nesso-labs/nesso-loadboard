import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '../types/domain'
import { useSessionsQuery } from './queries'

const STORAGE_KEY = 'loadboard.currentSessionId'

interface CurrentSessionValue {
  sessions: Session[]
  currentSessionId: string | undefined
  currentSession: Session | undefined
  setCurrentSessionId: (id: string) => void
  isLoading: boolean
}

const CurrentSessionContext = createContext<CurrentSessionValue | null>(null)

export function CurrentSessionProvider({ children }: { children: ReactNode }) {
  const { data: sessions = [], isLoading } = useSessionsQuery()
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? undefined
    } catch {
      return undefined
    }
  })

  // Default to the most recent session once sessions load, if nothing (or a
  // now-deleted session) is selected.
  useEffect(() => {
    if (sessions.length === 0) return
    const stillExists = sessions.some((s) => s.id === currentSessionId)
    if (!currentSessionId || !stillExists) {
      setCurrentSessionId(sessions[0].id)
    }
  }, [sessions, currentSessionId])

  const handleSetCurrentSessionId = (id: string) => {
    setCurrentSessionId(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // localStorage unavailable — selection just won't survive a reload.
    }
  }

  const currentSession = useMemo(() => sessions.find((s) => s.id === currentSessionId), [sessions, currentSessionId])

  const value: CurrentSessionValue = {
    sessions,
    currentSessionId,
    currentSession,
    setCurrentSessionId: handleSetCurrentSessionId,
    isLoading,
  }

  return <CurrentSessionContext.Provider value={value}>{children}</CurrentSessionContext.Provider>
}

export function useCurrentSession(): CurrentSessionValue {
  const ctx = useContext(CurrentSessionContext)
  if (!ctx) throw new Error('useCurrentSession must be used within CurrentSessionProvider')
  return ctx
}
