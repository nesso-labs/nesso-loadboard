import { useQuery } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useEffect } from 'react'
import { type CurrentUser, getCurrentUser } from '../lib/db/repo'

export type { CurrentUser, Role } from '../lib/db/repo'

interface AuthValue {
  user: CurrentUser | undefined
  isLoading: boolean
  isAdmin: boolean
  isEditor: boolean
  isViewer: boolean
  /** True if the signed-in user can create/modify workspace data — an Editor or an Admin, never a Viewer. */
  canEdit: boolean
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    staleTime: Infinity,
    retry: false,
  })

  // A session that goes invalid mid-visit (expired, or the account was
  // deactivated) surfaces here as a failed fetch, not a redirect — force a
  // full navigation so the server-side gate in _middleware.ts takes back
  // over and serves the login page, instead of leaving a blank screen.
  useEffect(() => {
    if (isError) window.location.href = '/'
  }, [isError])

  const value: AuthValue = {
    user,
    isLoading,
    isAdmin: user?.role === 'admin',
    isEditor: user?.role === 'editor',
    isViewer: user?.role === 'viewer',
    canEdit: user?.role === 'editor' || user?.role === 'admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
