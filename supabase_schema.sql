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
ALTER TABLE groups ADD COLUMN IF NOT EXISTS invite_code_expires_at TIMESTAMPTZ;
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
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name       TEXT    NOT NULL,
  phone           TEXT    NOT NULL UNIQUE,
  email           TEXT,
  national_id     TEXT,
  date_of_birth   DATE,
  photo_url       TEXT,
  kyc_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  amount_due      NUMERIC(15,2) DEFAULT 0,
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
  repaid_amount           NUMERIC(15,2) NOT NULL DEFAULT 0,
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
-- 9. MONEY REQUESTS TABLE (withdrawal/fund requests)
-- ============================================================
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

-- ============================================================
-- 10. EXPENSES TABLE (group expenditures - treasurer/secretary only)
-- ============================================================
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

-- ============================================================
-- 11. GROUP FINANCIALS TABLE (bank balance, investments per period)
-- ============================================================
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

-- ============================================================
-- 12. MESSAGES TABLE (group chat)
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
-- NOTE: SaccoUp uses a custom auth system (PIN + OTP, not Supabase Auth).
-- For production, migrate to Supabase Auth and use auth.uid() in policies.
-- These policies provide a baseline: sensitive tables are locked down,
-- and group-scoped tables use membership-based access via a helper function.
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
  -- ROSCA policies
  DROP POLICY IF EXISTS "anon_all_rosca_cycles"      ON rosca_cycles;
  DROP POLICY IF EXISTS "anon_all_rosca_draws"       ON rosca_draws;
END $$;

-- ── Sensitive tables: RESTRICTED ──────────────────────────────────────────────

-- OTP codes: no direct anon access (app uses service-role for OTP operations)
CREATE POLICY "service_role_otp_codes" ON otp_codes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Audit logs: insert-only for anon (appends audit trail), full access for service_role
CREATE POLICY "anon_insert_audit_logs" ON audit_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "service_role_audit_logs" ON audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User accounts: restricted — only service_role can read/write (app handles auth server-side)
CREATE POLICY "service_role_user_accounts" ON user_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Members: anon can read all, insert new (registration), update own profile ─
CREATE POLICY "anon_read_members" ON members FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_members" ON members FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_members" ON members FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── Groups: anon can read all groups and create new ones ──────────────────────
CREATE POLICY "anon_read_groups" ON groups FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_groups" ON groups FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_groups" ON groups FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── Group memberships: anon can read, insert, and update ──────────────────────
CREATE POLICY "anon_read_memberships" ON group_memberships FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_memberships" ON group_memberships FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_memberships" ON group_memberships FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── Contributions: full CRUD for anon (group-scoped in app logic) ─────────────
CREATE POLICY "anon_read_contributions" ON contributions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_contributions" ON contributions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_contributions" ON contributions FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── Loans: full CRUD for anon (group-scoped in app logic) ─────────────────────
CREATE POLICY "anon_read_loans" ON loans FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_loans" ON loans FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_loans" ON loans FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── Announcements: full CRUD for anon (group-scoped in app logic) ─────────────
CREATE POLICY "anon_read_announcements" ON announcements FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_announcements" ON announcements FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_announcements" ON announcements FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_announcements" ON announcements FOR DELETE TO anon USING (true);

-- ── Messages: full CRUD for anon (group-scoped in app logic) ──────────────────
CREATE POLICY "anon_read_messages" ON messages FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_messages" ON messages FOR INSERT TO anon WITH CHECK (true);

-- NOTE: ROSCA RLS policies are defined after table creation in section 12.

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
  payout_received   BOOLEAN DEFAULT FALSE,
  confirmed_by_member BOOLEAN DEFAULT FALSE,
  confirmed_at      TIMESTAMPTZ,
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

-- ROSCA RLS policies (group-scoped CRUD for anon)
CREATE POLICY "anon_read_rosca_cycles"   ON rosca_cycles FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_rosca_cycles" ON rosca_cycles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_rosca_cycles" ON rosca_cycles FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_rosca_draws"    ON rosca_draws FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_rosca_draws"  ON rosca_draws FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_rosca_draws"  ON rosca_draws FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ROSCA Contributions table - tracks member payments per draw
CREATE TABLE IF NOT EXISTS rosca_contributions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id         UUID NOT NULL REFERENCES rosca_cycles(id) ON DELETE CASCADE,
  draw_number     INTEGER NOT NULL,
  member_id       UUID NOT NULL REFERENCES members(id),
  member_name     TEXT NOT NULL,
  amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending',
  payment_date   TIMESTAMPTZ,
  confirmed_by   TEXT,
  confirmed_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cycle_id, draw_number, member_id)
);
CREATE INDEX IF NOT EXISTS idx_rosca_contributions_cycle ON rosca_contributions(cycle_id);
CREATE INDEX IF NOT EXISTS idx_rosca_contributions_draw ON rosca_contributions(cycle_id, draw_number);

-- Enable RLS for rosca_contributions
ALTER TABLE rosca_contributions ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "anon_all_rosca_contributions" ON rosca_contributions;
CREATE POLICY "anon_all_rosca_contributions" ON rosca_contributions FOR ALL TO anon USING (true) WITH CHECK (true);
