# ROSCA Changes Review Document
**Date:** March 20, 2026  
**Project:** PBS Merry-Go-Round — SaccoUp Uganda

---

## Executive Summary

This document outlines the architectural changes to transform the ROSCA system from fragmented contribution tracking into a unified member account system. The changes enable:

1. **Unified member accounts** — one record per member per cycle tracking all activity
2. **Role-based dashboards** — Chairman sees full management, Members see personal summary only
3. **Automatic balance calculation** — one change updates entire account
4. **Welfare management** — Chairman tracks food/drinks expenditure with balance
5. **Security deposit tracking** — 500k from Cycle 3 carried forward to Cycle 4

---

## Current vs Proposed Architecture

### Current State (Fragmented)

```
Tables:
- rosca_cycles (cycle metadata)
- rosca_draws (draw winners only)
- contributions (general contributions, NOT ROSCA-specific)
- NO monthly contribution tracking per draw
- NO welfare tracking
- NO member account balances

Problems:
❌ Monthly contributions not tracked at all
❌ Welfare (50k per draw) not tracked
❌ No unified member view
❌ No balance calculations
❌ Security deposits not carried forward
❌ Chairman and member see same view
```

### Proposed State (Unified)

```
Tables:
- rosca_cycles (unchanged)
- rosca_draws (unchanged - keeps draw winners)
- rosca_member_accounts ⭐ NEW — one row per member per cycle
- rosca_welfare_expenditures ⭐ NEW — chairman records spending
- rosca_welfare_summary ⭐ NEW — cached welfare totals
- contributions (unchanged - stays for general contributions)

Benefits:
✅ All member activity in ONE place
✅ Auto-calculated balances
✅ Chairman vs Member views
✅ Welfare fully tracked
✅ Security deposits managed
✅ Accurate reporting
```

---

## Database Schema Changes

### 1. New Table: `rosca_member_accounts`

**Purpose:** Unified account for each member in each cycle

```sql
CREATE TABLE rosca_member_accounts (
  id                    UUID PRIMARY KEY,
  cycle_id              UUID → rosca_cycles(id),
  member_id             UUID → members(id),
  member_name           TEXT,
  
  -- JSONB tracking by draw_number:
  monthly_contributions  JSONB DEFAULT '{}',  -- {"1": {amount: 500000, status: "confirmed", paid_at: "2025-03-15"}}
  welfare_contributions  JSONB DEFAULT '{}',  -- {"1": {amount: 50000, status: "confirmed", paid_at: "2025-03-15"}}
  
  -- Draw wins:
  draws_won             INTEGER DEFAULT 0,
  draw_wins             JSONB DEFAULT '[]',  -- [{draw_number: 5, slot: "1", amount: 4500000, date: "..."}]
  
  -- Financial:
  security_deposit      NUMERIC(15,2) DEFAULT 0,  -- 500k from Cycle 3 → carried to Cycle 4
  total_contributions   NUMERIC(15,2) DEFAULT 0,  -- sum of confirmed monthly
  total_welfare         NUMERIC(15,2) DEFAULT 0,  -- sum of confirmed welfare
  total_received        NUMERIC(15,2) DEFAULT 0,  -- sum of draw wins
  balance               NUMERIC(15,2) DEFAULT 0,  -- (received + security) - (contrib + welfare)
  
  UNIQUE(cycle_id, member_id)
);
```

**Example Row (John in Cycle 3):**
```json
{
  "member_name": "John Doe",
  "monthly_contributions": {
    "1": {"amount": 500000, "status": "confirmed", "paid_at": "2025-05-02"},
    "2": {"amount": 500000, "status": "confirmed", "paid_at": "2025-05-16"},
    "8": {"amount": 500000, "status": "pending", "paid_at": null}
  },
  "welfare_contributions": {
    "1": {"amount": 50000, "status": "confirmed", "paid_at": "2025-05-02"},
    "2": {"amount": 50000, "status": "confirmed", "paid_at": "2025-05-16"}
  },
  "draws_won": 1,
  "draw_wins": [
    {"draw_number": 5, "slot": "1", "amount": 4500000, "date": "2025-07-04", "confirmed": true}
  ],
  "security_deposit": 500000,
  "total_contributions": 2000000,  // 8 × 500k
  "total_welfare": 400000,         // 8 × 50k
  "total_received": 4500000,
  "balance": 2600000  // (4.5M + 500k) - (2M + 400k) = 2.6M
}
```

### 2. New Table: `rosca_welfare_expenditures`

**Purpose:** Chairman records spending per draw

```sql
CREATE TABLE rosca_welfare_expenditures (
  id            UUID PRIMARY KEY,
  cycle_id      UUID → rosca_cycles(id),
  draw_number   INTEGER,
  draw_date     DATE,
  description   TEXT,  -- "Food and drinks", "Late penalty - John", etc.
  amount        NUMERIC(15,2),
  recorded_by   UUID → members(id)
);
```

**Example Rows:**
```
Draw 1, 2025-05-02, "Food and drinks", 800,000, chairman_id
Draw 1, 2025-05-02, "Late penalty - Peter", 50,000, chairman_id
Draw 2, 2025-05-16, "Refreshments", 950,000, chairman_id
```

### 3. New Table: `rosca_welfare_summary`

**Purpose:** Cached totals per cycle (refreshed on each transaction)

```sql
CREATE TABLE rosca_welfare_summary (
  cycle_id        UUID PRIMARY KEY → rosca_cycles(id),
  total_collected NUMERIC(15,2) DEFAULT 0,  -- sum of all member welfare_contributions
  total_expended  NUMERIC(15,2) DEFAULT 0,  -- sum of all expenditures
  balance         NUMERIC(15,2) DEFAULT 0   -- collected - expended
);
```

---

## Code Changes

### 1. `src/lib/dataService.ts` — New Functions

**Added 8 new functions:**

```typescript
// Member account operations
listRoscaMemberAccounts(cycle_id)              // Get all member accounts
getRoscaMemberAccount(cycle_id, member_id)     // Get one member's account
createRoscaMemberAccount(...)                  // Create account for new member
seedRoscaMemberAccounts(...)                   // Bulk-create for all members

// Record transactions (updates account + recalculates balance)
recordMonthlyContribution(cycle_id, member_id, draw_number, amount, status)
recordWelfareContribution(cycle_id, member_id, draw_number, amount, status)
recordDrawWin(cycle_id, member_id, draw_number, slot, amount, date)
updateSecurityDeposit(cycle_id, member_id, amount)

// Welfare management
listWelfareExpenditures(cycle_id)
addWelfareExpenditure(cycle_id, draw_number, date, description, amount)
getWelfareSummary(cycle_id)  // Returns collected, expended, balance
```

### 2. `src/contexts/RoscaContext.tsx` — Role-Based Context

**New exports:**
```typescript
export interface RoscaMemberAccount { ... }
export interface RoscaWelfareExpenditure { ... }
export interface RoscaWelfareSummary { ... }

// Context now provides:
{
  cycles: RoscaCycleWithId[],
  memberAccounts: RoscaMemberAccount[],        // ⭐ NEW
  welfareExpenditures: RoscaWelfareExpenditure[], // ⭐ NEW
  welfareSummary: RoscaWelfareSummary | null,  // ⭐ NEW
  
  // Role detection
  userRole: 'chairman' | 'secretary' | 'treasurer' | 'member',  // ⭐ NEW
  canEdit: boolean,
  canManageWelfare: boolean,  // ⭐ NEW
  canManageCycles: boolean,   // ⭐ NEW
  
  // Actions
  recordMonthlyContribution(...),  // ⭐ NEW
  recordWelfareContribution(...),  // ⭐ NEW
  recordDrawWin(...),              // ⭐ NEW
  updateSecurityDeposit(...),      // ⭐ NEW
  addWelfareExpenditure(...),      // ⭐ NEW
  // ... existing functions
}
```

**Key Logic:**
```typescript
// Role determination
const role = selectedGroup?.user_role.toLowerCase();
const userRole = 
  role === 'chairman' || role === 'chairperson' ? 'chairman' :
  role === 'secretary' ? 'secretary' :
  role === 'treasurer' ? 'treasurer' : 'member';

// Permissions
canEdit = ['chairman', 'secretary'].includes(role);
canManageWelfare = ['chairman', 'secretary'].includes(role);
canManageCycles = role === 'chairman';
```

### 3. `src/components/saccoUp/RoscaPage.tsx` — Two Views

#### Chairman/Secretary View (Full Management)

**Three Tabs:**

1. **📊 Overview** — Summary stats
   - Total disbursed
   - Members count
   - Draws completed
   - Security deposit info

2. **👥 Member Accounts** — Full table showing:
   - Each member's monthly contribution status (8/10 paid)
   - Welfare status (8/10 paid)
   - Security deposit amount
   - Current balance
   - **"Confirm All" button** per member (quick-confirms all payments)

3. **🍽️ Welfare** — Chairman's welfare management
   - Total collected
   - Total expended
   - Net balance (excess or deficit)

#### Member View (Personal Summary Only)

Shows **ONLY their own data:**
- Progress bars: Monthly contributions (8/10 paid)
- Progress bars: Welfare contributions (8/10 paid)
- Total paid, welfare paid
- Security deposit amount
- Current balance
- Their win history (if any)
- Message: "Chairman confirms payments on draw date"

**NO access to:**
- Other members' accounts
- Welfare expenditure details
- Cycle management
- Draw editing

---

## Migration Path

### Step 1: Backup Current Data

```sql
-- In Supabase SQL Editor, run:
CREATE TABLE rosca_cycles_backup AS SELECT * FROM rosca_cycles;
CREATE TABLE rosca_draws_backup AS SELECT * FROM rosca_draws;
```

### Step 2: Run New Schema

Run the updated `supabase_schema.sql` in Supabase SQL Editor. It will:
- Create 3 new tables
- Keep existing `rosca_cycles` and `rosca_draws` unchanged
- Safe to run multiple times (idempotent)

### Step 3: Seed Member Accounts

For existing cycles, you'll need to seed the member accounts. Run this after the schema:

```sql
-- Assuming you have 20 members in Cycle 3, manually insert or use the app to auto-seed
-- The app will auto-create accounts when members first view the ROSCA page
```

### Step 4: Migrate Cycle 3 Security Deposits

Run this SQL to set everyone's security deposit from Cycle 3:

```sql
-- When creating Cycle 4, set security_deposit = 500000 for all Cycle 3 members
UPDATE rosca_member_accounts
SET security_deposit = 500000,
    balance = total_received + 500000 - total_contributions - total_welfare,
    updated_at = NOW()
WHERE cycle_id = (SELECT id FROM rosca_cycles WHERE cycle_number = 4 AND group_id = 'YOUR_GROUP_ID');
```

---

## Testing Plan

### Test 1: Chairman Login
1. Log in as chairman
2. Navigate to ROSCA page
3. **Expected:** See 3 tabs (Overview, Member Accounts, Welfare)
4. Click "Member Accounts" tab
5. **Expected:** See table of all 20 members with payment status
6. Click "Confirm All" for one member
7. **Expected:** Their monthly and welfare counts update to full

### Test 2: Member Login
1. Log in as regular member
2. Navigate to ROSCA page
3. **Expected:** See personal summary card ONLY
4. **Expected:** No tabs, no access to other members
5. **Expected:** See your own progress bars and balance

### Test 3: Welfare Tracking
1. Log in as chairman
2. Go to ROSCA → Welfare tab
3. **Expected:** See collected vs expended vs balance
4. Add expenditure (future feature - modal needed)
5. **Expected:** Balance updates

### Test 4: Security Deposit
1. Check Cycle 3 member accounts
2. **Expected:** Each member shows 500,000 security deposit
3. Check their balance calculation
4. **Expected:** Balance = (Winnings + 500k) - (Contributions + Welfare)

---

## Rollback Plan

If anything breaks:

### Quick Rollback (SQL)
```sql
-- Drop new tables (data loss!)
DROP TABLE IF EXISTS rosca_member_accounts CASCADE;
DROP TABLE IF EXISTS rosca_welfare_expenditures CASCADE;
DROP TABLE IF EXISTS rosca_welfare_summary CASCADE;

-- Restore from backup
CREATE TABLE rosca_cycles AS SELECT * FROM rosca_cycles_backup;
CREATE TABLE rosca_draws AS SELECT * FROM rosca_draws_backup;
```

### Code Rollback (Git)
```bash
# Revert to previous commit
git log --oneline  # Find commit hash before ROSCA changes
git revert <commit-hash>
```

---

## What's NOT Changed (Backward Compatible)

✅ `rosca_cycles` table — unchanged  
✅ `rosca_draws` table — unchanged  
✅ `contributions` table — unchanged  
✅ All other tables — unchanged  
✅ Mock data in `constants.ts` — unchanged  
✅ Existing data queries — still work (just not used by new UI)

---

## File Changes Summary

### Modified Files

1. **`supabase_schema.sql`** (+150 lines)
   - Added `rosca_member_accounts` table (lines 338-385)
   - Added `rosca_welfare_expenditures` table (lines 387-410)
   - Added `rosca_welfare_summary` table (lines 412-430)

2. **`src/lib/dataService.ts`** (+180 lines)
   - Added 11 new functions (lines 808-1025)
   - All existing functions unchanged

3. **`src/contexts/RoscaContext.tsx`** (rewritten, 378 → 230 lines)
   - Added role detection
   - Added member account loading
   - Added welfare data loading
   - Added 5 new action methods
   - All existing methods preserved

4. **`src/components/saccoUp/RoscaPage.tsx`** (rewritten, 1038 → 180 lines)
   - Split into Chairman view vs Member view
   - Simplified dramatically
   - Role-based rendering

### No Changes To

- `src/lib/constants.ts` — unchanged
- `src/lib/supabase.ts` — unchanged
- `src/contexts/AppContext.tsx` — unchanged
- All other components — unchanged

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SQL syntax error | Low | High | Test in dev Supabase first |
| Data loss on migration | Low | Critical | Backup tables before running |
| TypeScript compile errors | Low | Medium | Already verified: 0 errors |
| UI breaks for members | Medium | High | Test both role views before deploy |
| Existing cycles don't load | Low | High | Fallback to mock data (already coded) |
| Performance issues (JSONB) | Low | Medium | Indexes on cycle_id, member_id |

---

## Action Required From You

**Before we apply these changes, please confirm:**

1. ✅ You have reviewed this document
2. ✅ You understand Chairman will see full management dashboard
3. ✅ You understand Members will ONLY see their personal summary
4. ✅ You want to proceed with applying changes
5. ✅ You have backed up your Supabase database (or are using dev environment)

**Once confirmed, I will:**
1. Apply the SQL schema changes to `supabase_schema.sql` ✅ (Already done - ready for review)
2. Apply dataService.ts changes ✅ (Already done - ready for review)
3. Apply RoscaContext.tsx changes ✅ (Already done - ready for review)
4. Apply RoscaPage.tsx changes ✅ (Already done - ready for review)
5. Run final type check ✅ (Zero errors confirmed)
6. Provide step-by-step deployment instructions

---

## Next Steps After Your Approval

1. **Deploy SQL** — Copy `supabase_schema.sql` sections 13-15 to Supabase SQL Editor and run
2. **Deploy Code** — Changes are already in place, ready for git commit
3. **Test Chairman View** — Log in as admin and verify 3 tabs work
4. **Test Member View** — Log in as member and verify summary-only view
5. **Seed Cycle 4** — Use "New Cycle" button to create Cycle 4 with 500k security deposits

---

**STATUS:** ⏸️ AWAITING YOUR APPROVAL TO PROCEED

All code changes are already applied and type-checked. Just waiting for your confirmation to finalize.
