# SaccoUp Implementation Plan

## Goal
Bring SaccoUp in line with the multi-tenant SACCO specification: proper role-based access, member-initiated payments with treasurer confirmation, chairman-controlled group creation, required invite codes, and complete registration fields.

---

## Changes by Requirement

### REQ 4: Role-Based Access Control (Foundation — do this first)

**What:** Centralize role checks so every page/component uses consistent permission logic.

**Approach:**
- Add a `usePermissions` hook or helper in `AppContext.tsx` that returns `isChairman`, `isTreasurer`, `isAdmin`, `isMember` based on `selectedGroup.user_role`
- Export these booleans from `useAppContext()`
- Apply guards in every page that has write operations

**Files:**
- `src/contexts/AppContext.tsx` — add `isChairman`, `isTreasurer`, `isAdmin` derived from `selectedGroup.user_role`
- `src/components/saccoUp/GroupsPage.tsx` — gate "Create Group" button (anyone can create, but they become chairman)
- `src/components/saccoUp/ContributionsPage.tsx` — gate confirm/fail buttons to `isTreasurer || isChairman`
- `src/components/saccoUp/LoansPage.tsx` — gate approve/disburse to `isTreasurer || isChairman`
- `src/components/saccoUp/RoscaPage.tsx` — gate create cycle / add draw to `isTreasurer || isChairman`
- `src/components/saccoUp/MembersPage.tsx` — gate add/remove/role-change to `isAdmin || isChairman`
- `src/components/saccoUp/AnnouncementsPage.tsx` — gate create/delete to `isAdmin || isChairman`

---

### REQ 5: Member Payment Flow (Member submits → Treasurer confirms)

**What:** Members can only record their OWN payment. It goes to "pending". Treasurer/Chairman confirms.

**Changes:**
- `src/lib/dataService.ts` `recordContribution()` — change `status: 'confirmed'` to `status: 'pending'` for ALL payment methods
- `src/components/saccoUp/ContributionsPage.tsx`:
  - For non-treasurer/non-chairman users: show "Record My Payment" button instead of "Record Contribution"
  - Pre-fill member name to current user, hide member selector
  - Contribution goes in as "pending"
  - Confirm/fail buttons only render for `isTreasurer || isChairman`
  - Members see only their own contributions (or all contributions in read-only mode)
- `src/components/saccoUp/ContributionsPage.tsx` "Record Contribution" modal:
  - For non-elevated roles: hide member selector, auto-fill with current user
  - For elevated roles: keep existing member selector

---

### REQ 6: Chairman-Only Group Creation

**What:** Any user can create a group. The creator automatically becomes chairman.

**Changes:**
- `src/lib/dataService.ts` `createGroup()` — change `role: 'admin'` to `role: 'chairperson'` on line 60
- No button restriction needed (anyone can create), but the creator's role must be `chairperson`

---

### REQ 7: Invitation Link & Code (Required for Registration)

**What:** Chairman generates invite code (auto-generated at creation). Shareable invite link. Code is REQUIRED to register.

**Changes:**
- `src/components/saccoUp/GroupsPage.tsx`:
  - Add "Generate Invite Link" button for chairman (produces URL like `https://saccoup.vercel.app/join?code=KAMX3F9A`)
  - Add "Regenerate Code" button for chairman (generates new code, invalidates old one)
- `src/lib/dataService.ts` — add `regenerateInviteCode(group_id)` function
- `src/components/saccoUp/LoginModal.tsx`:
  - Make invite code field REQUIRED (remove "optional" label)
  - Validate invite code against Supabase before showing the full registration form
  - If code is invalid, show error and block registration
  - If code is valid, show group name and proceed with registration
- Registration flow in `AppContext.tsx`:
  - Validate invite code FIRST before allowing registration
  - If no code or invalid code, reject registration

---

### REQ 8: Registration Fields (NIN, Email, Date of Birth)

**What:** Collect NIN, email, and date of birth during registration. Photo already required.

**Schema change needed (SQL migration):**
```sql
ALTER TABLE members ADD COLUMN IF NOT EXISTS date_of_birth DATE;
```

**Changes:**
- `src/components/saccoUp/LoginModal.tsx` registration form:
  - Add NIN field (text, required, placeholder "CM12345678")
  - Add Email field (email, required)
  - Add Date of Birth field (date input, required)
  - Add validation: NIN must not be empty, email must be valid format, DOB must not be future date
- `src/contexts/AppContext.tsx` `register()` function:
  - Accept new params: `nationalId`, `email`, `dateOfBirth`
  - Pass to `supabase.from('members').insert()`: add `national_id`, `email`, `date_of_birth`

---

### REQ 1: Multi-tenant Group Switching

**What:** Easy way to switch between groups from anywhere in the app.

**Changes:**
- `src/components/saccoUp/Sidebar.tsx`:
  - Add a group selector dropdown at the top (below logo, above nav items)
  - Shows current group name + role badge
  - Dropdown lists all groups the user belongs to
  - Selecting a group calls `setSelectedGroupId()`
- `src/contexts/AppContext.tsx`:
  - Make sure `setSelectedGroupId` is exposed and triggers a refresh of all data

---

## Files Changed Summary

| File | Changes |
|---|---|
| `src/contexts/AppContext.tsx` | Add `isChairman`, `isTreasurer`, `isAdmin` to context. Update `register()` to accept NIN, email, DOB |
| `src/components/saccoUp/Sidebar.tsx` | Add group selector dropdown |
| `src/components/saccoUp/LoginModal.tsx` | Add NIN, email, DOB fields. Make invite code required + validated |
| `src/components/saccoUp/GroupsPage.tsx` | Add invite link generator, regenerate code button |
| `src/components/saccoUp/ContributionsPage.tsx` | Role-based UI: members record own payment (pending), treasurer confirms |
| `src/components/saccoUp/LoansPage.tsx` | Gate approve/disburse to treasurer/chairman |
| `src/components/saccoUp/RoscaPage.tsx` | Gate create cycle/add draw to treasurer/chairman |
| `src/components/saccoUp/MembersPage.tsx` | Gate add/remove/role-change to admin/chairman |
| `src/components/saccoUp/AnnouncementsPage.tsx` | Gate create/delete to admin/chairman |
| `src/lib/dataService.ts` | Change contribution default to "pending". Add `regenerateInviteCode()`. Change group creator role to "chairperson" |
| `supabase_schema.sql` | Add `date_of_birth` column to members |
| `migration_dob.sql` | One-line migration for users to run |

## Order of Implementation

1. **AppContext** — add permission helpers (`isChairman`, `isTreasurer`, `isAdmin`)
2. **dataService** — change contribution status to "pending", change creator role to "chairperson", add `regenerateInviteCode`
3. **LoginModal** — add NIN, email, DOB fields; make invite code required
4. **AppContext** — update `register()` for new fields
5. **ContributionsPage** — role-based UI for member-initiated payments
6. **GroupsPage** — invite link generator, regenerate code
7. **Sidebar** — group selector dropdown
8. **LoansPage, RoscaPage, MembersPage, AnnouncementsPage** — role-based guards
9. **Schema** — add `date_of_birth` column, create migration SQL file
10. **Verify** — typecheck, tests, build, Supabase smoke test

## Questions Answered

- **Who creates groups?** → Any user. Creator becomes chairman.
- **Invite code required?** → Yes. Must validate before registration form shows.
- **Who confirms payments?** → Treasurer + Chairman.
- **Who manages ROSCA?** → Treasurer + Chairman.
