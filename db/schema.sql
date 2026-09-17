-- Cloudflare D1 Schema for Crystal Bracelet Studio
-- Table: beads (單一商品 = 單一尺寸扁平結構)

CREATE TABLE IF NOT EXISTS beads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  diameter_mm REAL NOT NULL CHECK (diameter_mm > 0),
  image_key TEXT,
  fallback_color TEXT NOT NULL DEFAULT '#D1D5DB',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_beads_category ON beads(category);
