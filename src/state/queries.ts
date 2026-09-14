import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listAllRpe,
  listAllSegments,
  listPlayers,
  listRpeBySession,
  listSegmentsByPlayer,
  listSegmentsBySession,
  listSessions,
  getSettings,
} from '../lib/db/repo'

export const queryKeys = {
  sessions: ['sessions'] as const,
  players: ['players'] as const,
  segmentsBySession: (sessionId: string) => ['segments', 'by-session', sessionId] as const,
  segmentsByPlayer: (playerId: string) => ['segments', 'by-player', playerId] as const,
  allSegments: ['segments', 'all'] as const,
  rpeBySession: (sessionId: string) => ['rpe', 'by-session', sessionId] as const,
  allRpe: ['rpe', 'all'] as const,
  settings: ['settings'] as const,
}

export function useSessionsQuery() {
  return useQuery({ queryKey: queryKeys.sessions, queryFn: listSessions })
}

export function usePlayersQuery() {
  return useQuery({ queryKey: queryKeys.players, queryFn: listPlayers })
}

export function useSegmentsBySessionQuery(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.segmentsBySession(sessionId ?? ''),
    queryFn: () => listSegmentsBySession(sessionId as string),
    enabled: !!sessionId,
  })
}

export function useSegmentsByPlayerQuery(playerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.segmentsByPlayer(playerId ?? ''),
    queryFn: () => listSegmentsByPlayer(playerId as string),
    enabled: !!playerId,
  })
}

export function useAllSegmentsQuery() {
  return useQuery({ queryKey: queryKeys.allSegments, queryFn: listAllSegments })
}

export function useRpeBySessionQuery(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.rpeBySession(sessionId ?? ''),
    queryFn: () => listRpeBySession(sessionId as string),
    enabled: !!sessionId,
  })
}

export function useAllRpeQuery() {
  return useQuery({ queryKey: queryKeys.allRpe, queryFn: listAllRpe })
}

export function useSettingsQuery() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: getSettings })
}

/** Invalidates everything a session import/edit/delete/RPE change can affect. */
export function useInvalidateAfterImport() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
    queryClient.invalidateQueries({ queryKey: queryKeys.players })
    queryClient.invalidateQueries({ queryKey: ['segments'] })
    queryClient.invalidateQueries({ queryKey: ['rpe'] })
  }
}
