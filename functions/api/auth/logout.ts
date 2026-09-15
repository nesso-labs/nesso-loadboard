import { CLEARED_SESSION_COOKIE } from '../../_lib/auth'
import type { Env } from '../../_lib/mappers'

export const onRequestPost: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 303,
    headers: { location: '/', 'set-cookie': CLEARED_SESSION_COOKIE, 'cache-control': 'no-store' },
  })
