-- ============================================================
-- ROSCA CONTRIBUTIONS & WELFARE TABLES
-- Run this in Supabase SQL Editor to add the missing tables
-- ============================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ROSCA DRAW CONTRIBUTIONS (per draw payment tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS rosca_draw_contributions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id           UUID NOT NULL REFERENCES rosca_draws(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES members(id),
  member_name       TEXT NOT NULL,
  contribution_type TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' or 'welfare'
  amount            NUMERIC(15,2) NOT NULL,
  payment_method    TEXT NOT NULL DEFAULT 'cash',
  status            TEXT NOT NULL DEFAULT 'pending',
  transaction_ref   TEXT,
  paid_at           TIMESTAMPTZ,
  recorded_by       UUID REFERENCES members(id),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rosca_draw_contributions_draw ON rosca_draw_contributions(draw_id);
CREATE INDEX IF NOT EXISTS idx_rosca_draw_contributions_member ON rosca_draw_contributions(member_id);

-- Enable RLS
ALTER TABLE rosca_draw_contributions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_all_rosca_draw_contributions" ON rosca_draw_contributions;
END $$;

CREATE POLICY "anon_all_rosca_draw_contributions" ON rosca_draw_contributions FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- ROSCA WELFARE TRACKING (food & drinks per draw)
-- ============================================================
CREATE TABLE IF NOT EXISTS rosca_welfare (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id        UUID NOT NULL REFERENCES rosca_cycles(id) ON DELETE CASCADE,
  draw_number     INTEGER NOT NULL,
  welfare_amount  NUMERIC(15,2) NOT NULL DEFAULT 50000,
  amount_spent    NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_remaining NUMERIC(15,2) GENERATED ALWAYS AS (welfare_amount - amount_spent) STORED,
  spent_items      JSONB, -- array of {item, cost, date, recorded_by}
  reported_by     UUID REFERENCES members(id),
  report_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rosca_welfare_cycle ON rosca_welfare(cycle_id);

-- Enable RLS
ALTER TABLE rosca_welfare ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_all_rosca_welfare" ON rosca_welfare;
END $$;

CREATE POLICY "anon_all_rosca_welfare" ON rosca_welfare FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- DONE! Tables created successfully.
-- ============================================================
