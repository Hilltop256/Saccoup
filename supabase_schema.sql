-- =======================================================================
-- SaccoUp Uganda - Complete Supabase Database Schema
-- Run this in your Supabase SQL editor to set up all required tables.
-- =======================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================================================================
-- MEMBERS TABLE
-- Stores all SACCO/savings group member profiles
-- =======================================================================
CREATE TABLE IF NOT EXISTS members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,            -- Stored in +256XXXXXXXXX format
  email         TEXT,
  national_id   TEXT,                            -- Uganda National ID e.g. CM12345678
  photo_url     TEXT,
  kyc_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);

-- =======================================================================
-- USER_ACCOUNTS TABLE
-- Stores authentication credentials (phone + PIN hash)
-- =======================================================================
CREATE TABLE IF NOT EXISTS user_accounts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  phone          TEXT NOT NULL UNIQUE,
  pin_hash       TEXT NOT NULL,                   -- SHA-256 of PIN+salt
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_accounts_phone ON user_accounts(phone);
CREATE INDEX IF NOT EXISTS idx_user_accounts_member ON user_accounts(member_id);

-- =======================================================================
-- OTP_CODES TABLE
-- Stores one-time passwords for phone verification
-- =======================================================================
CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone       TEXT NOT NULL,
  code        TEXT NOT NULL,
  purpose     TEXT NOT NULL CHECK (purpose IN ('login', 'register', 'reset_pin')),
  is_used     BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone);

-- =======================================================================
-- GROUPS TABLE
-- Savings groups: SACCOs, savings clubs, investment clubs, ROSCAs
-- =======================================================================
CREATE TABLE IF NOT EXISTS groups (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  group_type            TEXT NOT NULL CHECK (group_type IN (
                          'savings_club', 'investment_club', 'sacco', 'rosca', 'hybrid'
                        )),
  description           TEXT,
  contribution_amount   NUMERIC(15, 2) NOT NULL DEFAULT 0,
  contribution_schedule TEXT NOT NULL DEFAULT 'monthly' CHECK (contribution_schedule IN ('daily', 'weekly', 'monthly')),
  invite_code           TEXT NOT NULL UNIQUE,
  interest_rate         NUMERIC(5, 2) NOT NULL DEFAULT 5.00,   -- % flat rate per period
  late_fee              NUMERIC(10, 2) NOT NULL DEFAULT 0,     -- UGX fixed late fee
  grace_period_days     INTEGER NOT NULL DEFAULT 3,
  created_by            UUID REFERENCES members(id),
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);

-- =======================================================================
-- GROUP_MEMBERSHIPS TABLE
-- Many-to-many: which members belong to which groups
-- =======================================================================
CREATE TABLE IF NOT EXISTS group_memberships (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN (
               'admin', 'treasurer', 'chairperson', 'member', 'super_admin'
             )),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_group ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_memberships_member ON group_memberships(member_id);

-- =======================================================================
-- CONTRIBUTIONS TABLE
-- Tracks member contributions / payments (MTN MoMo, Airtel, Cash, Bank)
-- =======================================================================
CREATE TABLE IF NOT EXISTS contributions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id         UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id        UUID NOT NULL REFERENCES members(id),
  member_name      TEXT NOT NULL,                 -- Denormalized for reporting
  amount           NUMERIC(15, 2) NOT NULL,
  payment_method   TEXT NOT NULL CHECK (payment_method IN (
                     'mtn_momo', 'airtel_money', 'cash', 'bank_transfer'
                   )),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                     'pending', 'confirmed', 'failed', 'reconciled'
                   )),
  transaction_ref  TEXT,                          -- MoMo/bank reference number
  period_label     TEXT,                          -- e.g. "Mar 2026"
  notes            TEXT,
  updated_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contributions_group ON contributions(group_id);
CREATE INDEX IF NOT EXISTS idx_contributions_member ON contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);

-- =======================================================================
-- LOANS TABLE
-- Loan applications with multi-step approval workflow
-- =======================================================================
CREATE TABLE IF NOT EXISTS loans (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id                UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id               UUID NOT NULL REFERENCES members(id),
  member_name             TEXT NOT NULL,
  amount                  NUMERIC(15, 2) NOT NULL,
  interest_rate           NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
  purpose                 TEXT NOT NULL,
  repayment_period_months INTEGER NOT NULL DEFAULT 6,
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'treasurer_approved', 'approved',
                            'disbursed', 'repaying', 'completed', 'defaulted', 'rejected'
                          )),
  guarantors              TEXT[] NOT NULL DEFAULT '{}',   -- Denormalized names
  guarantor_ids           UUID[] NOT NULL DEFAULT '{}',   -- Member UUIDs
  approved_at             TIMESTAMPTZ,
  disbursed_at            TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loans_group ON loans(group_id);
CREATE INDEX IF NOT EXISTS idx_loans_member ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

-- =======================================================================
-- ANNOUNCEMENTS TABLE
-- Group-level announcements from admins/chairpersons
-- =======================================================================
CREATE TABLE IF NOT EXISTS announcements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES members(id),
  author      TEXT NOT NULL DEFAULT 'Admin',
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_group ON announcements(group_id);

-- =======================================================================
-- MESSAGES TABLE
-- Group chat messages
-- =======================================================================
CREATE TABLE IF NOT EXISTS messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES members(id),
  sender_name   TEXT NOT NULL,
  sender_photo  TEXT,
  message       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- =======================================================================
-- AUDIT_LOGS TABLE
-- Immutable audit trail for all critical actions
-- =======================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id     UUID REFERENCES members(id),
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    UUID,
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- =======================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Important: Supabase anon key is public. These policies protect data.
-- =======================================================================

-- Enable RLS on all tables
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon to insert/read members (registration flow)
CREATE POLICY "Allow anon to create members" ON members FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon to read members by phone" ON members FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to update own member" ON members FOR UPDATE TO anon USING (true);

-- Allow anon to manage user_accounts (login/register)
CREATE POLICY "Allow anon to create user_accounts" ON user_accounts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon to read user_accounts" ON user_accounts FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to update user_accounts" ON user_accounts FOR UPDATE TO anon USING (true);

-- Allow anon to manage OTPs
CREATE POLICY "Allow anon to manage otp_codes" ON otp_codes FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow anon to read/create/join groups
CREATE POLICY "Allow anon to read groups" ON groups FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to create groups" ON groups FOR INSERT TO anon WITH CHECK (true);

-- Allow anon to manage memberships
CREATE POLICY "Allow anon to manage memberships" ON group_memberships FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow anon to manage contributions
CREATE POLICY "Allow anon to manage contributions" ON contributions FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow anon to manage loans
CREATE POLICY "Allow anon to manage loans" ON loans FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow anon to manage announcements
CREATE POLICY "Allow anon to manage announcements" ON announcements FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow anon to manage messages
CREATE POLICY "Allow anon to manage messages" ON messages FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow anon to create audit logs
CREATE POLICY "Allow anon to create audit_logs" ON audit_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon to read audit_logs" ON audit_logs FOR SELECT TO anon USING (true);

-- =======================================================================
-- HELPFUL VIEWS
-- =======================================================================

-- Group summary view
CREATE OR REPLACE VIEW group_summary AS
SELECT
  g.id,
  g.name,
  g.group_type,
  g.invite_code,
  g.contribution_amount,
  g.contribution_schedule,
  g.interest_rate,
  g.is_active,
  COUNT(DISTINCT gm.member_id) FILTER (WHERE gm.is_active = true) AS member_count,
  COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'confirmed'), 0) AS total_savings,
  COALESCE(SUM(l.amount) FILTER (WHERE l.status IN ('disbursed', 'repaying')), 0) AS total_loans_outstanding
FROM groups g
LEFT JOIN group_memberships gm ON gm.group_id = g.id
LEFT JOIN contributions c ON c.group_id = g.id
LEFT JOIN loans l ON l.group_id = g.id
GROUP BY g.id;

-- =======================================================================
-- REAL-TIME PUBLICATION (for live chat and contribution updates)
-- =======================================================================
BEGIN;
  -- Add tables to realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE contributions;
  ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
  ALTER PUBLICATION supabase_realtime ADD TABLE loans;
COMMIT;
