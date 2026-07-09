-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- Creates the scores table for the Flag Quiz leaderboard

CREATE TABLE IF NOT EXISTS scores (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  time INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert scores (public = unauthenticated users)
CREATE POLICY "Allow public inserts"
  ON scores
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow anyone to read scores
CREATE POLICY "Allow public selects"
  ON scores
  FOR SELECT
  TO public
  USING (true);

-- Speed up weekly queries
CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores (created_at);
