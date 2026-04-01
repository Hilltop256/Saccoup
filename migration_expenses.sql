-- SaccoUp: Create expenses and group_financials tables
-- Run this in Supabase Dashboard > SQL Editor
-- Safe to run multiple times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS expenses (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        UUID          NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description     TEXT          NOT NULL,
  amount          NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  category        TEXT          NOT NULL DEFAULT 'general',
  period_label    TEXT,
  recorded_by     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);

CREATE TABLE IF NOT EXISTS group_financials (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        UUID          NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  period_label    TEXT          NOT NULL,
  bank_balance    NUMERIC(15,2) NOT NULL DEFAULT 0,
  investments     NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_expenses  NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  recorded_by     TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ,
  UNIQUE(group_id, period_label)
);
CREATE INDEX IF NOT EXISTS idx_group_financials_group ON group_financials(group_id);
