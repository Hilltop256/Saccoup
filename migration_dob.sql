-- SaccoUp: Add date_of_birth column to members table
-- Run this in Supabase Dashboard > SQL Editor
-- Safe to run multiple times (IF NOT EXISTS).
ALTER TABLE members ADD COLUMN IF NOT EXISTS date_of_birth DATE;
