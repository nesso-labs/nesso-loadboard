/**
 * PBKDF2-SHA256 password hashing via Web Crypto — there is no bcrypt/argon2
 * native binding in the Workers runtime, but PBKDF2 through crypto.subtle
 * runs natively (not a JS loop), so the iteration count below stays fast.
 *
 * Stored format is self-describing so the scheme/cost can change later
 * without invalidating existing hashes:
 *   pbkdf2-sha256$<iterations>$<saltB64url>$<hashB64url>
 */

/**
 * The Workers runtime rejects PBKDF2 above 100k iterations outright: verified on
 * production, 100_000 derives fine and 100_001 throws, which surfaces as an
 * opaque 1101 on every login. So OWASP's 210k recommendation is not reachable
 * here — this is the ceiling, not a tuning choice, and raising it makes every
 * account it hashes permanently unable to log in.
 */
const MAX_ITERATIONS = 100_000
const ITERATIONS = MAX_ITERATIONS
const SALT_BYTES = 16
const HASH_BYTES = 32

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, HASH_BYTES * 8)
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await deriveBits(password, salt, ITERATIONS)
  return `pbkdf2-sha256$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`
}

/** Re-derives at the stored cost/salt and compares byte-by-byte — never a JS `===` on secret material. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false
  const iterations = Number(parts[1])
  if (!Number.isSafeInteger(iterations) || iterations <= 0) return false
  // A hash stored above the runtime's ceiling can never be re-derived here, so
  // deriveBits would throw and take the login down. Refuse it as a failed
  // comparison instead — the account needs a password reset, not a 500.
  if (iterations > MAX_ITERATIONS) return false

  const salt = fromBase64Url(parts[2])
  const expected = fromBase64Url(parts[3])
  const actual = await deriveBits(password, salt, iterations)
  if (actual.length !== expected.length) return false

  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}
