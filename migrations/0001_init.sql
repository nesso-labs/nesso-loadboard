CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  source_file_name TEXT,
  raw_row_count INTEGER NOT NULL,
  warning_count INTEGER NOT NULL,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  position TEXT NOT NULL,
  personal_max_speed_kmh REAL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_players_display_name ON players(display_name);

CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  drill_title TEXT NOT NULL,
  segment_kind TEXT NOT NULL,
  duration_sec REAL NOT NULL,
  total_distance_m REAL NOT NULL,
  distance_per_min REAL NOT NULL,
  distance_zone4_m REAL NOT NULL,
  distance_zone5_m REAL NOT NULL,
  distance_zone6_m REAL NOT NULL,
  entries_zone5 REAL NOT NULL,
  entries_zone6 REAL NOT NULL,
  hsr_m REAL NOT NULL,
  hsr_per_min REAL NOT NULL,
  max_speed_kmh REAL NOT NULL,
  pct_max_speed REAL NOT NULL,
  acc_zone3 REAL NOT NULL,
  dec_zone3 REAL NOT NULL,
  acc_zone4 REAL NOT NULL,
  dec_zone4 REAL NOT NULL,
  acc_zone5 REAL NOT NULL,
  dec_zone5 REAL NOT NULL,
  acc_zone6 REAL NOT NULL,
  dec_zone6 REAL NOT NULL,
  acc_per_min REAL NOT NULL,
  dec_per_min REAL NOT NULL,
  dropped_duplicates TEXT,
  warnings TEXT,
  is_synthesized_full_session INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_segments_session ON segments(session_id);
CREATE INDEX IF NOT EXISTS idx_segments_player ON segments(player_id);
CREATE INDEX IF NOT EXISTS idx_segments_session_kind ON segments(session_id, segment_kind);

CREATE TABLE IF NOT EXISTS rpe (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  rpe REAL NOT NULL,
  s_rpe REAL NOT NULL,
  entered_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rpe_session ON rpe(session_id);
CREATE INDEX IF NOT EXISTS idx_rpe_player ON rpe(player_id);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
