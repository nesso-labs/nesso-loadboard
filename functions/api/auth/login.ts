import {
  createSessionCookie,
  equalsConstantTime,
  loginPage,
  misconfigured,
  safeReturnPath,
} from '../../_lib/auth'
import type { Env } from '../../_lib/mappers'

/** Blunt brute-force tax. One user, one password — a slow guess is a dead guess. */
const FAILED_ATTEMPT_DELAY_MS = 500

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SITE_PASSWORD) return misconfigured()

  const form = await request.formData()
  const submitted = String(form.get('password') ?? '')
  const returnPath = safeReturnPath(String(form.get('next') ?? '/'))

  if (!(await equalsConstantTime(submitted, env.SITE_PASSWORD))) {
    await new Promise((resolve) => setTimeout(resolve, FAILED_ATTEMPT_DELAY_MS))
    return loginPage(returnPath, 'Password errata.')
  }

  // 303 so the browser re-issues the follow-up as a GET rather than
  // re-POSTing the password on refresh.
  return new Response(null, {
    status: 303,
    headers: {
      location: returnPath,
      'set-cookie': await createSessionCookie(env.SITE_PASSWORD),
      'cache-control': 'no-store',
    },
  })
}

/** Someone landing here directly gets the form, not a 405. */
export const onRequestGet: PagesFunction<Env> = async ({ request }) =>
  loginPage(safeReturnPath(new URL(request.url).searchParams.get('next')))
