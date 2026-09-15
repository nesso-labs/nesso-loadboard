/**
 * Site-wide password gate (single-user deployment).
 *
 * The session cookie is `<expiry>.<hmac>`, signed with the site password
 * itself. That means there is no second secret to provision, and rotating the
 * password invalidates every outstanding session for free.
 *
 * `__Host-` prefix is not decoration here: the site is served on
 * nesso-loadboard.pages.dev, so every OTHER Pages project in the world is a
 * sibling subdomain of pages.dev and could set a `Domain=pages.dev` cookie
 * that our origin would receive. Browsers refuse to accept a `__Host-` cookie
 * carrying a Domain attribute, so a sibling cannot forge this one.
 */

const COOKIE_NAME = '__Host-loadboard_session'
const TOKEN_VERSION = 'v1'

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

const encoder = new TextEncoder()

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

/**
 * Compares via fixed-length digests rather than the raw strings: `===` returns
 * early on the first differing byte (and on a length mismatch), which leaks
 * how much of a guess was correct.
 */
export async function equalsConstantTime(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([sha256(a), sha256(b)])
  let diff = 0
  for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i]
  return diff === 0
}

function base64url(buffer: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sign(password: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)))
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return null
}

export async function createSessionCookie(password: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const signature = await sign(password, `${TOKEN_VERSION}:${expiresAt}`)
  return `${COOKIE_NAME}=${expiresAt}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`
}

export const CLEARED_SESSION_COOKIE = `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`

export async function hasValidSession(request: Request, password: string): Promise<boolean> {
  const token = readCookie(request, COOKIE_NAME)
  if (!token) return false

  const separator = token.indexOf('.')
  if (separator === -1) return false

  const expiresAt = Number(token.slice(0, separator))
  if (!Number.isSafeInteger(expiresAt) || expiresAt * 1000 <= Date.now()) return false

  const expected = await sign(password, `${TOKEN_VERSION}:${expiresAt}`)
  return equalsConstantTime(token.slice(separator + 1), expected)
}

/**
 * Only same-origin absolute paths survive, so the login form cannot be turned
 * into an open redirect. `//evil.com` is a protocol-relative URL, not a path.
 */
export function safeReturnPath(candidate: string | null): string {
  if (!candidate || !candidate.startsWith('/')) return '/'
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) return '/'
  return candidate
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Self-contained login page: inline CSS, no JS, no import of the React
 * bundle. The bundle is itself behind the gate, so a login screen that
 * depended on it could never render — this has to stand on its own.
 *
 * The palette is duplicated from src/index.css rather than imported, for the
 * same reason. Keep the two in step: the brand blue carries identity, the
 * yellow is reserved for the call to action.
 */
export function loginPage(returnPath: string, error?: string): Response {
  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>LoadBoard — Accesso</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700&family=Work+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    color-scheme: light dark;
    --page: #faf8f3; --surface: #ffffff; --ink: #12172b;
    --ink-secondary: #4b5468; --ink-muted: #8991a3;
    --border: rgba(29, 78, 216, 0.14);
    --primary: #1d4ed8;
    --accent: #fbbf24; --accent-ink: #12172b;
    --critical: #d03b3b;
    --cta-glow: none;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --page: #070c10; --surface: #101820; --ink: #f4f6f9;
      --ink-secondary: #9aabbd; --ink-muted: #5c6b7d;
      --border: rgba(74, 156, 235, 0.22);
      --primary: #3b82f6;
      --accent: #f4c430; --accent-ink: #070c10;
      --critical: #e66767;
      --cta-glow: 0 6px 20px -4px rgba(244, 196, 48, 0.45);
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; padding: 24px;
    display: flex; align-items: center; justify-content: center;
    background: var(--page); color: var(--ink);
    font-family: "Work Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  main {
    width: 100%; max-width: 360px; padding: 36px 30px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px;
  }
  h1 {
    margin: 0; color: var(--primary);
    font-family: "Big Shoulders Display", "Work Sans", system-ui, sans-serif;
    font-size: 34px; font-weight: 700; letter-spacing: 0.01em; line-height: 1.05;
    text-transform: uppercase;
  }
  p.sub { margin: 8px 0 26px; font-size: 13px; color: var(--ink-muted); }
  label { display: block; font-size: 12px; font-weight: 500; color: var(--ink-secondary); margin-bottom: 6px; }
  input {
    width: 100%; padding: 10px 12px; font: inherit; font-size: 14px;
    color: var(--ink); background: var(--page);
    border: 1px solid var(--border); border-radius: 6px;
  }
  input:focus { outline: 2px solid var(--primary); outline-offset: 1px; }
  button {
    width: 100%; margin-top: 18px; padding: 11px 12px; font: inherit;
    font-size: 14px; font-weight: 600; cursor: pointer; border-radius: 6px;
    color: var(--accent-ink); background: var(--accent); border: 0;
    box-shadow: var(--cta-glow); transition: opacity 0.15s;
  }
  button:hover { opacity: 0.9; }
  .error {
    margin: 0 0 18px; padding: 9px 11px; font-size: 13px; border-radius: 6px;
    color: var(--critical); border: 1px solid var(--critical);
  }
</style>
</head>
<body>
  <main>
    <h1>LoadBoard</h1>
    <p class="sub">Accesso riservato. Inserisci la password per continuare.</p>
    ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
    <form method="POST" action="/api/auth/login">
      <input type="hidden" name="next" value="${escapeHtml(returnPath)}" />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password"
             autofocus required />
      <button type="submit">Entra</button>
    </form>
  </main>
</body>
</html>`

  return new Response(html, {
    status: error ? 401 : 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Never let an intermediary cache the gate itself.
      'cache-control': 'no-store',
    },
  })
}

/** The gate cannot enforce anything without the secret — refuse, loudly. */
export function misconfigured(): Response {
  return new Response(
    'SITE_PASSWORD is not configured for this deployment. The site stays closed until it is set.',
    { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } },
  )
}
