# SaccoUp

Multi-Tenant Finance Savings Groups Platform for Uganda's SACCOs, savings clubs, investment clubs, and ROSCAs (Merry-Go-Rounds).

## Features

- Member management with role-based access (admin, chairperson, treasurer, secretary, member)
- Contribution tracking with mobile money integration (MTN MoMo & Airtel Money)
- Loans management with guarantors and approval workflow
- ROSCA/Merry-Go-Round cycle and draw tracking
- Financial reporting with PDF/CSV export
- Group chat with Supabase Realtime
- Announcements
- Settings with UMRA compliance toggle

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + RLS)
- **State:** React Context API + @tanstack/react-query
- **Charts:** Recharts
- **Testing:** Vitest + React Testing Library

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your Supabase project URL and anon key:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Set up the database

1. Go to your Supabase project dashboard
2. Open **SQL Editor**
3. Copy the contents of `supabase_schema.sql` and run it
4. This creates all tables, indexes, and RLS policies

### 4. Run the development server

```bash
npm run dev
```

The app runs at `http://localhost:8080`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 8080) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run preview` | Preview production build |

## Known Limitations

- **Mobile Money:** MTN MoMo and Airtel Money APIs are stubbed. Contributions via mobile money auto-confirm in demo mode.
- **SMS Notifications:** Requires Twilio or Africa's Talking API configuration.
- **i18n:** Language toggle (Luganda) is UI-only; no internationalization system is implemented.
- **Auth:** Uses a custom PIN + OTP system. For production, migrate to Supabase Auth.
- **RLS:** Sensitive tables (otp_codes, user_accounts) are locked to service_role. Group-scoped tables use anon access. Tighten with Supabase Auth for production.
