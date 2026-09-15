import { hasValidSession, loginPage, misconfigured, safeReturnPath } from './_lib/auth'
import { json } from './_lib/json'
import type { Env } from './_lib/mappers'

/**
 * Whole-site password gate.
 *
 * A root-level `_middleware.ts` runs ahead of static assets on every path, so
 * this covers the SPA shell, the JS/CSS bundle and the D1-backed API alike —
 * there is no route that reaches a client-side check first. (Keep it that way:
 * adding a `_routes.json` that excludes paths would punch a hole straight
 * through this.)
 */
const PUBLIC_PATHS = new Set(['/api/auth/login', '/api/auth/logout', '/favicon.svg'])

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  const url = new URL(request.url)

  // The login endpoint has to stay reachable or there is no way back in.
  if (PUBLIC_PATHS.has(url.pathname)) return next()

  if (!env.SITE_PASSWORD) return misconfigured()
  if (await hasValidSession(request, env.SITE_PASSWORD)) return next()

  // An unauthenticated XHR should fail as data, not as a login page the
  // fetch caller would try to parse as JSON.
  if (url.pathname.startsWith('/api/')) {
    return json({ error: 'unauthorized' }, { status: 401, headers: { 'cache-control': 'no-store' } })
  }

  return loginPage(safeReturnPath(url.pathname + url.search))
}
