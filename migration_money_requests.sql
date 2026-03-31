-- SaccoUp: Create money_requests table for fund withdrawal requests
-- Run this in Supabase Dashboard > SQL Editor
-- Safe to run multiple times (IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS money_requests (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        UUID          NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id       UUID          NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_name     TEXT          NOT NULL,
  amount          NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  reason          TEXT          NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disbursed')),
  requested_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_money_requests_group  ON money_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_money_requests_status ON money_requests(group_id, status);
