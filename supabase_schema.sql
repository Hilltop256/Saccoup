-- ============================================================
-- SaccoUp Uganda — Complete Database Setup
-- Project: saccoup-prd (hfashvzkvohylakpwisc.supabase.co)
--
-- HOW TO RUN:
--   1. Go to https://supabase.com/dashboard/project/hfashvzkvohylakpwisc
--   2. Click "SQL Editor" in the left sidebar
--   3. Click "New query"
--   4. Select ALL the text in this file and paste it in
--   5. Click "Run" (or press Ctrl+Enter)
--
-- Safe to run multiple times — uses IF NOT EXISTS throughout.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PATCH EXISTING groups TABLE
--    (The groups table already exists with only 4 columns.
--     This adds all the missing columns the app needs.)
-- ============================================================
ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_type            TEXT          NOT NULL DEFAULT 'savings_club';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS description           TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS contribution_amount   NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS contribution_schedule TEXT          NOT NULL DEFAULT 'monthly';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS invite_code           TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS interest_rate         NUMERIC(5,2)  NOT NULL DEFAULT 5.00;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS late_fee              NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS grace_period_days     INTEGER       NOT NULL DEFAULT 3;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_active             BOOLEAN       NOT NULL DEFAULT TRUE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW();

-- Generate invite codes for any existing rows that have none
UPDATE groups SET invite_code = UPPER(SUBSTR(MD5(id::text), 1, 8)) WHERE invite_code IS NULL;

-- Make invite_code required and unique
ALTER TABLE groups ALTER COLUMN invite_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);
CREATE INDEX        IF NOT EXISTS idx_groups_created_by  ON groups(created_by);

-- ============================================================
-- 2. MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS members (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name    TEXT    NOT NULL,
  phone        TEXT    NOT NULL UNIQUE,
  email        TEXT,
  national_id  TEXT,
  photo_url    TEXT,
  kyc_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);

-- ============================================================
-- 3. USER_ACCOUNTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_accounts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  phone         TEXT NOT NULL UNIQUE,
  pin_hash      TEXT NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_accounts_phone  ON user_accounts(phone);
CREATE INDEX IF NOT EXISTS idx_user_accounts_member ON user_accounts(member_id);

-- ============================================================
-- 4. OTP_CODES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_codes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone      TEXT NOT NULL,
  code       TEXT NOT NULL,
  purpose    TEXT NOT NULL DEFAULT 'login',
  is_used    BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone);

-- ============================================================
-- 5. GROUP_MEMBERSHIPS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS group_memberships (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id  UUID NOT NULL REFERENCES groups(id)  ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role      TEXT    NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_group  ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_memberships_member ON group_memberships(member_id);

-- ============================================================
-- 6. CONTRIBUTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS contributions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        UUID          NOT NULL REFERENCES groups(id)  ON DELETE CASCADE,
  member_id       UUID          NOT NULL REFERENCES members(id),
  member_name     TEXT          NOT NULL,
  amount          NUMERIC(15,2) NOT NULL,
  payment_method  TEXT          NOT NULL DEFAULT 'cash',
  status          TEXT          NOT NULL DEFAULT 'pending',
  transaction_ref TEXT,
  period_label    TEXT,
  notes           TEXT,
  updated_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contributions_group  ON contributions(group_id);
CREATE INDEX IF NOT EXISTS idx_contributions_member ON contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);

-- ============================================================
-- 7. LOANS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS loans (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id                UUID          NOT NULL REFERENCES groups(id)  ON DELETE CASCADE,
  member_id               UUID          NOT NULL REFERENCES members(id),
  member_name             TEXT          NOT NULL,
  amount                  NUMERIC(15,2) NOT NULL,
  interest_rate           NUMERIC(5,2)  NOT NULL DEFAULT 5.00,
  purpose                 TEXT          NOT NULL,
  repayment_period_months INTEGER       NOT NULL DEFAULT 6,
  status                  TEXT          NOT NULL DEFAULT 'pending',
  guarantors              TEXT[]        NOT NULL DEFAULT '{}',
  guarantor_ids           UUID[]        NOT NULL DEFAULT '{}',
  approved_at             TIMESTAMPTZ,
  disbursed_at            TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loans_group  ON loans(group_id);
CREATE INDEX IF NOT EXISTS idx_loans_member ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

-- ============================================================
-- 8. ANNOUNCEMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES members(id),
  author     TEXT NOT NULL DEFAULT 'Admin',
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  is_pinned  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_group ON announcements(group_id);

-- ============================================================
-- 9. MESSAGES TABLE (group chat)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id    UUID NOT NULL REFERENCES members(id),
  sender_name  TEXT NOT NULL,
  sender_photo TEXT,
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_group  ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- ============================================================
-- 10. AUDIT_LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES members(id),
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor  ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist (so re-runs don't error)
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_all_members"           ON members;
  DROP POLICY IF EXISTS "anon_all_user_accounts"     ON user_accounts;
  DROP POLICY IF EXISTS "anon_all_otp_codes"         ON otp_codes;
  DROP POLICY IF EXISTS "anon_all_groups"            ON groups;
  DROP POLICY IF EXISTS "anon_all_group_memberships" ON group_memberships;
  DROP POLICY IF EXISTS "anon_all_contributions"     ON contributions;
  DROP POLICY IF EXISTS "anon_all_loans"             ON loans;
  DROP POLICY IF EXISTS "anon_all_announcements"     ON announcements;
  DROP POLICY IF EXISTS "anon_all_messages"          ON messages;
  DROP POLICY IF EXISTS "anon_all_audit_logs"        ON audit_logs;
END $$;

-- Allow the app's anon key to read and write all tables
CREATE POLICY "anon_all_members"           ON members           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_user_accounts"     ON user_accounts     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_otp_codes"         ON otp_codes         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_groups"            ON groups            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_group_memberships" ON group_memberships FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_contributions"     ON contributions     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_loans"             ON loans             FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_announcements"     ON announcements     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_messages"          ON messages          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_audit_logs"        ON audit_logs        FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- All done. SaccoUp database is ready.
-- ============================================================

-- ============================================================
-- 12. ROSCA (Merry-Go-Round) TABLES
-- ============================================================

-- ROSCA Cycles table - one row per cycle
CREATE TABLE IF NOT EXISTS rosca_cycles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id              UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  cycle_number          INTEGER NOT NULL,
  cycle_name            TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'upcoming',
  start_date            DATE NOT NULL,
  end_date             DATE,
  total_draws          INTEGER NOT NULL DEFAULT 10,
  pot_amount_per_draw   NUMERIC(15,2) NOT NULL DEFAULT 5000000,
  member_count          INTEGER NOT NULL DEFAULT 20,
  security_deposit      NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, cycle_number)
);
CREATE INDEX IF NOT EXISTS idx_rosca_cycles_group ON rosca_cycles(group_id);

-- ROSCA Draws table - one row per winner slot (2 winners per draw)
CREATE TABLE IF NOT EXISTS rosca_draws (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id          UUID NOT NULL REFERENCES rosca_cycles(id) ON DELETE CASCADE,
  draw_number       INTEGER NOT NULL,
  winner_slot       TEXT NOT NULL CHECK (winner_slot IN ('1', '2')),
  winner_name       TEXT,
  winner_id         TEXT,
  amount_received   NUMERIC(15,2) NOT NULL DEFAULT 5000000,
  draw_date         DATE NOT NULL,
  savings           NUMERIC(15,2),
  paid_out          NUMERIC(15,2),
  deductions        NUMERIC(15,2),
  balance           NUMERIC(15,2),
  status            TEXT NOT NULL DEFAULT 'pending',
  notes             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cycle_id, draw_number, winner_slot)
);
CREATE INDEX IF NOT EXISTS idx_rosca_draws_cycle ON rosca_draws(cycle_id);

-- Enable RLS for ROSCA tables
ALTER TABLE rosca_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rosca_draws  ENABLE ROW LEVEL SECURITY;

-- Drop old policies if exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_all_rosca_cycles" ON rosca_cycles;
  DROP POLICY IF EXISTS "anon_all_rosca_draws"  ON rosca_draws;
END $$;

-- Allow full access
CREATE POLICY "anon_all_rosca_cycles" ON rosca_cycles FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_rosca_draws"  ON rosca_draws  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- 13. ROSCA DRAW CONTRIBUTIONS (per draw payment tracking)
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
-- 14. ROSCA WELFARE TRACKING (food & drinks per draw)
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
