# Soupresso — Cash Register

A small, standalone web app for the daily cash-box reconciliation: count the
box, settle yesterday's bazar advance, set aside tomorrow's bazar money and
bhangti, and see what's left to take home. Every day is saved to a real
database so you can review history and do month-end analysis later. Separate
from (and much simpler than) the big analytics report — this app only does
the cash register, receipts, a light dashboard, and menu/production tracking.

## What's inside

- **Daily Entry** — count today's box (by denomination or a direct total),
  enter opening bhangti, settle the bazar advance, set aside tomorrow's
  amounts. Tomorrow's opening values are automatically suggested from
  yesterday's saved entry.
- **Receipts** — browse any saved day, see a clean receipt breakdown, print it.
- **Dashboard** — most recent day, this month's totals, a 14-day sales chart.
- **Products** — track how many of each menu item sold per day, and manage
  menu items and prices.
- **Login** — single shared email/password, checked server-side against
  environment variables (never in any file that reaches the browser).

## How the password actually stays secret

You mentioned wanting to avoid a hardcoded password baked into an HTML file.
Here's the equivalent (and more secure) approach used here, since Vercel
doesn't run PHP:

- `APP_EMAIL` and `APP_PASSWORD` are **environment variables** — set in
  Vercel's dashboard for production, or in a local `.env.local` file for
  development. They are never written into any file that ships to the
  browser, and never appear in client-side JavaScript.
- The login API route compares the submitted password to `APP_PASSWORD` on
  the server only.
- On success, it signs a session token (using `SESSION_SECRET`) and sets it
  as an **httpOnly** cookie — meaning client-side JavaScript cannot read it
  at all, so it's invisible to view-source, browser devtools, and extensions.
- **To change the password later:** update `APP_PASSWORD` in Vercel's
  dashboard (Project → Settings → Environment Variables) and redeploy. No
  code change, nothing to leak.

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment template and fill it in:
   ```bash
   cp .env.example .env.local
   ```
   For local development, point `DATABASE_URL` at any Postgres database you
   have running (see `.env.example` for the format). Generate a
   `SESSION_SECRET` with:
   ```bash
   openssl rand -base64 32
   ```

3. Create the database tables (and seed the starter menu):
   ```bash
   npm run db:init
   ```

4. Run the dev server:
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000 — you'll be redirected to `/login`.

## Deploying to Vercel

1. **Push this project to a GitHub repository.**

2. **Create a Postgres database.** The easiest path is Vercel's own
   integration: in your Vercel project, go to the **Storage** tab → **Create
   Database** → Postgres (this provisions a Neon-backed database and can
   auto-fill the connection env vars for you). Any other Postgres provider
   (Neon, Supabase, etc.) works too — you just need its connection string.

3. **Import the project into Vercel** (New Project → import your GitHub
   repo). Vercel auto-detects Next.js — no build configuration needed.

4. **Set environment variables** in the Vercel project (Settings →
   Environment Variables):
   - `DATABASE_URL` — your Postgres connection string (if you used Vercel's
     Postgres integration, this may already be filled in for you — check the
     exact variable name it used and adjust `lib/db.js` if it differs, e.g.
     some integrations use `POSTGRES_URL` instead)
   - `APP_EMAIL` — the email used to sign in
   - `APP_PASSWORD` — the password used to sign in
   - `SESSION_SECRET` — a long random string (`openssl rand -base64 32`)
   - `DATABASE_SSL` — leave unset (defaults to requiring SSL, which hosted
     Postgres providers need)

5. **Initialize the database schema.** Run this once, from your local
   machine, pointed at the production database:
   ```bash
   DATABASE_URL="<your production connection string>" node scripts/init-db.js
   ```
   (Or paste the contents of `schema.sql` into your database provider's SQL
   console — either way works.)

6. **Deploy.** Vercel will build and deploy automatically on push. Visit your
   deployed URL — you should land on `/login`.

## Project structure

```
app/
  login/           — sign-in page
  entry/           — daily cash entry (the core feature)
  history/         — browsable, printable receipts
  dashboard/       — monthly aggregates + trend
  products/        — menu items + daily quantities sold
  api/             — all backend routes (auth, entries, dashboard, products, daily-sales)
lib/
  db.js            — shared Postgres connection pool
  auth.js          — session token signing/verification
  cash-math.js     — the cash-reconciliation formulas (used by both the
                      entry form's live preview and the API's save logic,
                      so they can never disagree)
middleware.js      — protects every route except /login
schema.sql         — database schema + starter menu seed
scripts/init-db.js — one-time setup script (runs schema.sql against DATABASE_URL)
```

## The math, precisely

- **Total Sales** = total counted in the box − opening bhangti (the float
  kept from yesterday). Nothing else — not revenue, not profit.
- **Bazar variance** = actual bazar cost − bazar advance received. Positive
  means the chef needs more money; negative means the chef returns the
  difference.
- **Cash taken home** = total counted − bazar variance − tomorrow's bazar
  advance − tomorrow's bhangti.

This logic lives in one place (`lib/cash-math.js`) and is unit-tested by the
project's test scripts before every change.

## What was deliberately left out of v1

Full weather/seasonal projections and the deeper analytics (the big HTML
report you already have covers that in depth). This app is intentionally
scoped to daily cash operations, receipts, and a lightweight dashboard — the
Products tab is there so you can start collecting per-item sales data now,
even before you need deeper analysis of it.
