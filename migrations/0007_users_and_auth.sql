-- Multi-user auth: email/password accounts with three roles (viewer, editor,
-- admin), each Editor owning an isolated workspace, each Viewer bound to one
-- Editor's workspace, and Admin scoped only to account management + the
-- login registry. See functions/_lib/auth.ts for how these are used.
--
-- This file is schema only — no seed data or secrets. After applying it,
-- run the one-off seed/backfill script (see the deployment notes) to create
-- the first accounts and assign existing rows to a workspace.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer','editor','admin')),
  workspace_owner_id TEXT REFERENCES users(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS login_audit (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  email_attempted TEXT NOT NULL,
  success INTEGER NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_user ON login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_created ON login_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_users_workspace_owner ON users(workspace_owner_id);

ALTER TABLE sessions ADD COLUMN workspace_id TEXT;
ALTER TABLE players ADD COLUMN workspace_id TEXT;
ALTER TABLE segments ADD COLUMN workspace_id TEXT;
ALTER TABLE rpe ADD COLUMN workspace_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_players_workspace ON players(workspace_id);
CREATE INDEX IF NOT EXISTS idx_segments_workspace ON segments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_rpe_workspace ON rpe(workspace_id);
