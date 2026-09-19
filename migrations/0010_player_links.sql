-- Cross-workspace player links: a player who trains with two different age-group
-- teams (two different Editor workspaces of the same club) can have their two
-- roster entries linked, by mutual consent, so their personal history/models
-- can be computed from both. Team-wide averages/leaderboards are NEVER affected
-- by this — only per-player computations opt into the merged data.

CREATE TABLE IF NOT EXISTS player_links (
  id TEXT PRIMARY KEY,
  player_a_workspace_id TEXT NOT NULL,
  player_a_id TEXT NOT NULL,
  player_b_workspace_id TEXT NOT NULL,
  player_b_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  proposed_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_links_a ON player_links(player_a_workspace_id, player_a_id);
CREATE INDEX IF NOT EXISTS idx_player_links_b ON player_links(player_b_workspace_id, player_b_id);
CREATE INDEX IF NOT EXISTS idx_player_links_status ON player_links(status);
