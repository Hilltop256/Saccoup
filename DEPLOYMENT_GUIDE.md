# PBS Merry-Go-Round — Deployment Guide
**Changes Applied:** March 20, 2026  
**Monthly Contribution:** UGX 500,000 per member per draw  
**Welfare:** UGX 50,000 per member per draw

---

## ✅ Changes Summary

### Database Changes
- ✅ Added `rosca_member_accounts` table (unified member accounts)
- ✅ Added `rosca_welfare_expenditures` table (chairman records spending)
- ✅ Added `rosca_welfare_summary` table (cached welfare totals)
- ✅ All existing tables remain unchanged

### Code Changes
- ✅ `src/lib/dataService.ts` — 11 new functions added
- ✅ `src/contexts/RoscaContext.tsx` — role-based context with permissions
- ✅ `src/components/saccoUp/RoscaPage.tsx` — Chairman vs Member dashboards
- ✅ TypeScript compilation: **0 errors**

### Key Features
- ✅ Monthly contributions: **UGX 500,000** per draw
- ✅ Welfare contributions: **UGX 50,000** per draw  
- ✅ Chairman sees full management (3 tabs)
- ✅ Members see personal summary only
- ✅ "Confirm All" button for chairman to quickly confirm payments
- ✅ Security deposits from Cycle 3 (500k each) ready to carry to Cycle 4

---

## Deployment Steps

### Step 1: Backup Current Database

In Supabase SQL Editor (https://supabase.com/dashboard/project/hfashvzkvohylakpwisc/sql/new):

```sql
-- Create backups (just in case)
CREATE TABLE IF NOT EXISTS rosca_cycles_backup AS SELECT * FROM rosca_cycles;
CREATE TABLE IF NOT EXISTS rosca_draws_backup AS SELECT * FROM rosca_draws;
```

### Step 2: Deploy Database Schema

Copy lines **338-447** from `supabase_schema.sql` and run in Supabase SQL Editor:

```sql
-- ============================================================
-- 13. UNIFIED ROSCA MEMBER ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS rosca_member_accounts (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id              UUID          NOT NULL REFERENCES rosca_cycles(id) ON DELETE CASCADE,
  member_id             UUID          NOT NULL REFERENCES members(id),
  member_name           TEXT          NOT NULL DEFAULT '',
  
  -- Monthly contributions: {"1": {"amount": 500000, "status": "confirmed", "paid_at": "2025-03-15"}, "2": {...}}
  monthly_contributions  JSONB         NOT NULL DEFAULT '{}',
  
  -- Welfare contributions: {"1": {"amount": 50000, "status": "confirmed", "paid_at": "2025-03-15"}, "2": {...}}
  welfare_contributions  JSONB         NOT NULL DEFAULT '{}',
  
  draws_won             INTEGER       NOT NULL DEFAULT 0,
  draw_wins             JSONB         NOT NULL DEFAULT '[]',
  security_deposit       NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_contributions    NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_welfare         NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_received        NUMERIC(15,2) NOT NULL DEFAULT 0,
  balance               NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  
  UNIQUE(cycle_id, member_id)
);

-- (Continue with remaining lines from the schema file...)
```

**Expected output:** Tables created successfully (or "already exists" if re-running)

### Step 3: Deploy Code Changes

The code changes are already applied. To deploy:

```bash
# If using git:
git add .
git commit -m "feat: unified ROSCA member accounts with role-based dashboards"
git push

# If deploying manually:
# Copy the modified files to your server/hosting
```

### Step 4: Seed Member Accounts for Cycle 3

After deploying, when the first user (chairman or member) visits the ROSCA page, the system will automatically create member accounts. Alternatively, run this SQL to pre-seed:

```sql
-- Get your Cycle 3 ID
SELECT id, cycle_name FROM rosca_cycles WHERE cycle_number = 3;

-- Insert member accounts for all 20 PBS members
-- Replace 'CYCLE_3_UUID' with the actual ID from above
INSERT INTO rosca_member_accounts (cycle_id, member_id, member_name, security_deposit)
SELECT 
  'CYCLE_3_UUID',
  m.id,
  m.full_name,
  500000  -- Security deposit from Cycle 3
FROM members m
WHERE m.id IN (
  SELECT member_id FROM group_memberships 
  WHERE group_id = 'YOUR_GROUP_ID' AND is_active = true
)
ON CONFLICT (cycle_id, member_id) DO NOTHING;
```

### Step 5: Create Cycle 4

Once Cycle 3 is complete:

1. Log in as chairman
2. Go to ROSCA page
3. Click **"+ New Cycle"** button
4. Fill in:
   - Cycle Name: "Cycle 4"
   - Status: "Active"
   - Start Date: (today's date)
   - Total Draws: 10
   - Members: 20
   - Pot per Winner: 5,000,000
   - **Security Deposit: 500,000** (this is the carryover from Cycle 3)
5. Click "Create Cycle"

The system will automatically:
- Create empty member accounts for all 20 members
- Set each member's security_deposit to 500,000
- Initialize their balances to +500,000 (since they haven't paid anything yet)

---

## Testing Checklist

### Test as Chairman

- [ ] Log in as admin/chairman
- [ ] Navigate to ROSCA page
- [ ] Verify you see **3 tabs**: Overview, Member Accounts, Welfare
- [ ] Click "Member Accounts" tab
- [ ] Verify you see all 20 members listed
- [ ] Click "Confirm All" for one member
- [ ] Verify their counts update (Monthly: 10/10, Welfare: 10/10)
- [ ] Go to "Welfare" tab
- [ ] Verify you see: Collected, Expended, Balance cards
- [ ] Click "+ New Cycle" button (if Cycle 4 not created yet)
- [ ] Fill in form and create Cycle 4
- [ ] Verify new cycle appears in the list

### Test as Member

- [ ] Log in as regular member (non-admin)
- [ ] Navigate to ROSCA page
- [ ] Verify you see **ONLY personal summary card**
- [ ] Verify you see:
  - Your name and cycle info
  - Monthly contributions progress (X/10 paid)
  - Welfare progress (X/10 paid)
  - Total paid, welfare paid
  - Security deposit amount
  - Current balance
- [ ] Verify you **DO NOT** see:
  - Other members' accounts
  - Tabs (Overview, Member Accounts, Welfare)
  - Any edit buttons
  - Welfare expenditure details

### Test Balance Calculations

- [ ] Chairman confirms a member's monthly payment (500k)
- [ ] Check that member's balance updates: `balance = (received + security) - (contributions + welfare)`
- [ ] Example: If member won 4.5M and has 500k security, paid 5M monthly + 500k welfare:
  - Balance = (4,500,000 + 500,000) - (5,000,000 + 500,000) = **-500,000** (owes group)

---

## What Each Role Sees

### 👑 Chairman (Full Control)

```
ROSCA Page:
├── Header: "PBS Merry-Go-Round" + Add Draw + New Cycle buttons
├── Tab 1: 📊 Overview
│   ├── Total Disbursed: UGX 40,500,000
│   ├── Members: 20
│   ├── Draws Completed: 10/10
│   └── Security Deposit: UGX 500,000/member
├── Tab 2: 👥 Member Accounts
│   ├── Table with all 20 members
│   ├── Columns: Name, Monthly (8/10), Welfare (8/10), Security, Balance
│   └── "Confirm All" button per member
└── Tab 3: 🍽️ Welfare
    ├── Total Collected: UGX 10,000,000 (20 × 10 draws × 50k)
    ├── Total Expended: UGX 8,500,000
    └── Balance: +UGX 1,500,000 (excess)
```

### 👤 Member (Personal View Only)

```
ROSCA Page:
└── My PBS Account Card
    ├── Name & Cycle info
    ├── Monthly Contributions: 8/10 paid (progress bar)
    ├── Welfare: 8/10 paid (progress bar)
    ├── Total Paid: UGX 4,000,000
    ├── Welfare Paid: UGX 400,000
    ├── Security Deposit: UGX 500,000
    ├── Balance: +UGX 600,000
    └── My Wins: Draw 5 (Slot 1) - UGX 4,500,000
```

---

## Important Notes

### Monthly Contribution Amount
**✅ CORRECTED:** All files now use **UGX 500,000** per member per draw (not 250k)

### Files Changed
1. `supabase_schema.sql` — 3 new tables added (lines 338-447)
2. `src/lib/dataService.ts` — 11 new functions added
3. `src/contexts/RoscaContext.tsx` — rebuilt with role detection
4. `src/components/saccoUp/RoscaPage.tsx` — split into Chairman/Member views

### Backward Compatibility
- ✅ Existing `rosca_cycles` table unchanged
- ✅ Existing `rosca_draws` table unchanged
- ✅ Existing `contributions` table unchanged
- ✅ All other parts of the app unaffected

---

## Support & Rollback

### If Something Breaks

1. **Restore database from backup:**
```sql
DROP TABLE IF EXISTS rosca_member_accounts CASCADE;
DROP TABLE IF EXISTS rosca_welfare_expenditures CASCADE;
DROP TABLE IF EXISTS rosca_welfare_summary CASCADE;

-- Restore from backup
CREATE TABLE rosca_cycles AS SELECT * FROM rosca_cycles_backup;
CREATE TABLE rosca_draws AS SELECT * FROM rosca_draws_backup;
```

2. **Revert code changes:**
```bash
git revert HEAD  # or restore previous files
```

### Get Help

If you encounter issues:
- Check browser console for errors
- Check Supabase logs for SQL errors
- Verify role permissions in `group_memberships` table

---

**STATUS:** ✅ ALL CHANGES APPLIED — READY FOR DEPLOYMENT

TypeScript: 0 errors  
Monthly Contributions: UGX 500,000 ✅  
Welfare: UGX 50,000 ✅  
Security Deposit: UGX 500,000 ✅
