-- SaccoUp: Add repaid_amount column to loans table
-- Run this in Supabase Dashboard > SQL Editor if your loans table doesn't have this column.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE loans ADD COLUMN IF NOT EXISTS repaid_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
