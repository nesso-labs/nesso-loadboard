import type { Env } from './mappers'

/**
 * Best-effort self-healing for columns added by a migration file that may
 * never actually have been run against the live database — Cloudflare Pages
 * does not auto-apply migrations/*.sql on deploy, and this repo has been
 * bitten more than once by code shipping ahead of a manual `wrangler d1
 * migrations apply` / dashboard step nobody completed. SQLite/D1 has no
 * `ADD COLUMN IF NOT EXISTS`, so this attempts each ALTER TABLE and swallows
 * the "duplicate column" failure that means it already exists — safe to call
 * on every request once the column is real, since only the very first call
 * per column ever does real work.
 */
export async function ensureColumns(env: Env, table: string, columns: { name: string; type: string }[]): Promise<void> {
  for (const col of columns) {
    try {
      await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`).run()
    } catch {
      // Column already exists — the expected steady state after the first successful run.
    }
  }
}
