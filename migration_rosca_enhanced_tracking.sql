-- Migration: Add Enhanced ROSCA Tracking Fields
-- Purpose: Track member payment history, shortfalls, security usage, and winning outcomes

-- Add fields to rosca_draws table for better payment tracking
ALTER TABLE rosca_draws ADD COLUMN IF NOT EXISTS expected_amount NUMERIC(15,2);
ALTER TABLE rosca_draws ADD COLUMN IF NOT EXISTS actual_amount NUMERIC(15,2);
ALTER TABLE rosca_draws ADD COLUMN IF NOT EXISTS payment_shortfall NUMERIC(15,2);
ALTER TABLE rosca_draws ADD COLUMN IF NOT EXISTS security_used NUMERIC(15,2) DEFAULT 0;
ALTER TABLE rosca_draws ADD COLUMN IF NOT EXISTS amount_due_at_winning NUMERIC(15,2);
ALTER TABLE rosca_draws ADD COLUMN IF NOT EXISTS actual_amount_received NUMERIC(15,2);
ALTER TABLE rosca_draws ADD COLUMN IF NOT EXISTS shortfall_at_winning NUMERIC(15,2);
ALTER TABLE rosca_draws ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE rosca_draws ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_rosca_draws_winner ON rosca_draws(winner_id, winner_name);
CREATE INDEX IF NOT EXISTS idx_rosca_draws_status ON rosca_draws(payment_status);

-- Add member_contributions table to track individual member payments per draw/month
CREATE TABLE IF NOT EXISTS rosca_member_contributions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id        UUID NOT NULL REFERENCES rosca_cycles(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL,
  member_name     TEXT NOT NULL,
  draw_number     INTEGER NOT NULL,
  expected_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  actual_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  shortfall       NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_date    DATE,
  payment_method  TEXT DEFAULT 'cash',
  status          TEXT NOT NULL DEFAULT 'pending',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cycle_id, member_id, draw_number)
);

CREATE INDEX IF NOT EXISTS idx_rosca_member_contributions_member ON rosca_member_contributions(member_id, cycle_id);

-- Enable RLS
ALTER TABLE rosca_member_contributions ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "anon_all_rosca_member_contributions" ON rosca_member_contributions;
CREATE POLICY "anon_all_rosca_member_contributions" ON rosca_member_contributions FOR ALL TO anon USING (true) WITH CHECK (true);

-- Add running balance tracking to rosca_cycles
ALTER TABLE rosca_cycles ADD COLUMN IF NOT EXISTS total_expected_contributions NUMERIC(15,2) DEFAULT 0;
ALTER TABLE rosca_cycles ADD COLUMN IF NOT EXISTS total_actual_contributions NUMERIC(15,2) DEFAULT 0;
ALTER TABLE rosca_cycles ADD COLUMN IF NOT EXISTS total_payouts NUMERIC(15,2) DEFAULT 0;
ALTER TABLE rosca_cycles ADD COLUMN IF NOT EXISTS total_security_deposits NUMERIC(15,2) DEFAULT 0;
ALTER TABLE rosca_cycles ADD COLUMN IF NOT EXISTS total_security_used NUMERIC(15,2) DEFAULT 0;
ALTER TABLE rosca_cycles ADD COLUMN IF NOT EXISTS current_pool_balance NUMERIC(15,2) DEFAULT 0;

-- Add payment history table for detailed tracking
CREATE TABLE IF NOT EXISTS rosca_payment_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id        UUID NOT NULL REFERENCES rosca_cycles(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL,
  member_name     TEXT NOT NULL,
  draw_number     INTEGER NOT NULL,
  payment_type    TEXT NOT NULL, -- 'monthly_contribution', 'winning_payout', 'security_deposit', 'security_withdrawal'
  expected_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  actual_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  difference      NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_date    DATE,
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'partial', 'paid', 'shortfall', 'waived'
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rosca_payment_history_member ON rosca_payment_history(member_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_rosca_payment_history_draw ON rosca_payment_history(cycle_id, draw_number);

ALTER TABLE rosca_payment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_rosca_payment_history" ON rosca_payment_history;
CREATE POLICY "anon_all_rosca_payment_history" ON rosca_payment_history FOR ALL TO anon USING (true) WITH CHECK (true);