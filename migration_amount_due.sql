-- SaccoUp: Add amount_due column to contributions for tracking expected vs actual
-- Run this in Supabase Dashboard > SQL Editor
-- Safe to run multiple times (IF NOT EXISTS).
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS amount_due NUMERIC(15,2) DEFAULT 0;
