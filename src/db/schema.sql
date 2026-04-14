-- Unit Templates Table
CREATE TABLE IF NOT EXISTS unit_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hp INTEGER NOT NULL,
    damage INTEGER NOT NULL,
    range INTEGER NOT NULL,
    movement_cooldown INTEGER NOT NULL,
    attack_cooldown INTEGER NOT NULL,
    tags TEXT NOT NULL -- JSON array
);

-- Matches Table
CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    winner TEXT NOT NULL,
    turns INTEGER NOT NULL,
    team_a TEXT NOT NULL, -- JSON
    team_b TEXT NOT NULL  -- JSON
);

-- Match Results Table
CREATE TABLE IF NOT EXISTS match_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    total_damage_team_a INTEGER NOT NULL,
    total_damage_team_b INTEGER NOT NULL,
    units_killed_team_a INTEGER NOT NULL,
    units_killed_team_b INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    FOREIGN KEY (match_id) REFERENCES matches (id)
);

-- Match Logs Table (optional)
CREATE TABLE IF NOT EXISTS match_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    tick INTEGER NOT NULL,
    state_summary TEXT NOT NULL, -- JSON
    FOREIGN KEY (match_id) REFERENCES matches (id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_timestamp ON matches(timestamp);
CREATE INDEX IF NOT EXISTS idx_matches_winner ON matches(winner);
CREATE INDEX IF NOT EXISTS idx_match_results_match_id ON match_results(match_id);
CREATE INDEX IF NOT EXISTS idx_match_logs_match_id ON match_logs(match_id);
