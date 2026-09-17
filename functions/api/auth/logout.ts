import { CLEARED_SESSION_COOKIE, destroySession } from '../../_lib/auth'
import type { Env } from '../../_lib/mappers'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  await destroySession(request, env)
  return new Response(null, {
    status: 303,
    headers: { location: '/', 'set-cookie': CLEARED_SESSION_COOKIE, 'cache-control': 'no-store' },
  })
}
