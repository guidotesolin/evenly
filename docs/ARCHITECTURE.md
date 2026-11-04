# Evenly — Architecture

> Source of truth for the design. The task board lives in [TASKS.md](./TASKS.md).
> Each task is executed by an independent session that reads these two documents and nothing else.

## Context

Guido and Sabrina live together and share household costs. Today that takes two tools:

1. **A personal spreadsheet for fixed costs** (Guido's "Gastos mensuales" on Google Sheets): one
   row per concept (rent, credit card, car, electricity, streaming, health insurance, taxes…), one
   column per month since August 2025, and a second sheet that divides every amount by a
   **reference dollar** entered at the start of each month, to see costs in USD. Since August 2026,
   rent and internet appear at half value: that is Guido's share after moving in together.
2. **Tricount for shared costs**: occasional expenses (greengrocer, supermarket) plus shared fixed
   costs (Guido pays electricity, Sabrina pays internet), split evenly. Small expenses are settled
   at the end of each month; **big ones (rent) are settled right away**.

Goal of v1: one Android app for both of them that replaces the spreadsheet and Tricount, starting
November 2026. Two screens only:

- **Fixed** (`Fijos`): private per person. Each user has their own list of fixed concepts and
  enters each month's amount, plus their own reference dollar.
- **Shared** (`Compartidos`): shared by the household. A Tricount-style list of expenses and
  reimbursements with a running balance and a "settle" action.

Secondary goal: the repo is **public on GitHub** as a mobile portfolio piece for Guido's CV. That
is why the stack is React Native rather than a PWA.

### Non-goals for v1

- No English, no i18n machinery. No iOS, no web.
- No scaling to other households beyond what the data model gives for free. There are thousands
  of similar apps; this one is for two people.
- No custom splits (percentages, uneven amounts). Splits are always equal among household members.
- No import of Tricount history: shared expenses start from zero in November 2026.

## Language conventions

| Layer                                                                                        | Language         | Why                                                                                      |
| -------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| All code and documentation: identifiers, tables, columns, comments, commits, `docs/`, README | English          | Public repo, portfolio piece; English is the stack's language                            |
| Conversation with Claude                                                                     | Spanish (voseo)  | Maintainer's language                                                                    |
| **Product UI**                                                                               | **Spanish only** | Only two users, both Argentinian. Strings are written inline in Spanish, no i18n library |

Product names map to code names: `Fijos` → `fixed`, `Compartidos` → `shared`, `Saldar` →
`settle`, `Reembolso` → `reimbursement`, `grupo familiar` → `household`, `dólar de referencia` →
`reference rate`.

## Stack

| Layer         | Choice                                                                                          | Why                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| App           | React Native + Expo (SDK current at T0), `expo-router`, TypeScript strict                       | Real Android app for the CV, reuses Guido's React/TS; Expo removes native tooling pain                                                 |
| Backend       | Supabase: Postgres + Auth + Row Level Security                                                  | No server to run; RLS keeps each person's fixed costs private; free tier covers two users                                              |
| Client data   | `@supabase/supabase-js` with generated types (`supabase gen types`)                             | Typed queries without an ORM; the DB is the API                                                                                        |
| Auth          | Google Sign-In: `@react-native-google-signin/google-signin` + `supabase.auth.signInWithIdToken` | Both use Google accounts; native flow, no passwords. Requires a dev build (`expo-dev-client`), not Expo Go                             |
| Session       | `expo-secure-store` as the Supabase auth storage; tokens refresh only while the app is active   | Android keystore-backed, no size cap there. Routing guards (`Stack.Protected`) read the session and the active `household_members` row |
| Distribution  | EAS Build (APK, `preview` profile) + EAS Update (OTA)                                           | Install directly on two phones, no Play Store; JS changes reach phones without reinstalling                                            |
| DB tooling    | Supabase CLI: `supabase/migrations/*.sql`, local stack via `supabase start`                     | Migrations are plain SQL, versioned in the repo                                                                                        |
| Lint / format | ESLint (`eslint-config-expo`) + Prettier + anti-slop (Oxlint)                                   | House standard; `npm run lint` = `eslint && oxlint`                                                                                    |
| Checks        | `tools/*-smoke.ts` run with Node's built-in type stripping (`node tools/x-smoke.ts`)            | One runnable check per non-trivial logic, no test framework                                                                            |
| CI            | GitHub Actions                                                                                  | Free for public repos                                                                                                                  |
| License       | MIT                                                                                             | Public portfolio repo                                                                                                                  |

Anti-slop adjustment: `no-runtime-typeof` runs with `allowInTypeGuards`. The only external data
parsed at a boundary is the spreadsheet import (T7), which uses Zod; the app talks to Supabase
through generated types.

## Cost

Target: **USD 0 per month**. Every piece runs on a free tier. Limits checked against
supabase.com/pricing and expo.dev/pricing on **2026-11-03** (T0).

| Piece            | Plan     | Limit that matters                                                                                                                                                                                 |
| ---------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase         | Free     | 500 MB database per project, 50k monthly active users, 2 active free projects. **A free project pauses after 7 days of inactivity**; daily use avoids it, and it can be resumed from the dashboard |
| EAS Build        | Free     | Up to 15 Android builds (the pricing page states no period), low-priority queue. Unlimited free fallback: `eas build --local`                                                                      |
| EAS Update       | Free     | 1,000 monthly active users and 100 GiB bandwidth, no paid overage on Free; two users never touch it                                                                                                |
| Google Sign-In   | Free     | OAuth client in Google Cloud, no billing account needed                                                                                                                                            |
| GitHub + Actions | Free     | Public repository                                                                                                                                                                                  |
| Play Store       | Not used | The APK is installed directly, avoiding the USD 25 developer account                                                                                                                               |

## Money

- **Amounts are whole pesos, stored as `bigint`.** No cents: in the Argentinian economy they are
  practically nonexistent. Formatting uses `Intl.NumberFormat('es-AR', { style: 'currency',
currency: 'ARS', maximumFractionDigits: 0 })`.
- The spreadsheet has a few amounts with cents (e.g. `$1,757,740.11`); the import rounds them.
- Shares can be fractional (1/3 of an amount). Shares and balances are computed as `numeric` in
  SQL and **rounded only for display**. Rejected: rounding each share at write time, because the
  rounding error accumulates in the running balance.
- **Reference rate** (`ars_per_usd`): `numeric`, one per user per month. USD estimates =
  ARS / rate, shown with 2 decimals. A month without a rate shows no USD estimate (not zero).

## Data model

All tables in `public`, all with RLS enabled. Months are stored as a `date` on the first day of
the month.

| Table               | Columns (beyond `id`, `created_at`)                                                                                                                                                      | Notes                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `profiles`          | `id` (= `auth.users.id`), `display_name`                                                                                                                                                 | Created by a trigger on `auth.users` insert, from the Google name                                               |
| `households`        | `name`, `invite_code` (unique, 6 chars)                                                                                                                                                  |                                                                                                                 |
| `household_members` | `household_id`, `user_id`, `joined_on` (date), `left_on` (date, null)                                                                                                                    | v1: a user belongs to at most one household at a time (partial unique index on `user_id where left_on is null`) |
| `fixed_concepts`    | `owner_id`, `name`, `is_shared` (bool), `archived_at` (null)                                                                                                                             | Private to the owner                                                                                            |
| `fixed_entries`     | `concept_id`, `month` (date), `amount` (bigint, **null = pending**); unique (`concept_id`, `month`)                                                                                      | Private to the owner (through the concept)                                                                      |
| `reference_rates`   | `owner_id`, `month`, `ars_per_usd` (numeric); unique (`owner_id`, `month`)                                                                                                               | Private to the owner                                                                                            |
| `shared_movements`  | `household_id`, `kind` (`expense` \| `reimbursement`), `paid_by`, `paid_to` (null for expenses), `description`, `amount` (bigint), `occurred_on` (date), `fixed_entry_id` (unique, null) | Visible to household members. Rows with `fixed_entry_id` are owned by the trigger, not editable from the app    |

### Equal split by date (`participant_count`)

An expense is split **equally among the members active on its `occurred_on` date**: `joined_on <=
occurred_on and (left_on is null or left_on > occurred_on)`. If a third person joins in December,
November's expenses stay split by two and only December's are split by three. A SQL function
`household_participants(household_id, date)` is the single place this rule lives;
`participant_count(household_id, date)` counts it. The balance view uses both, and the fixed
screen's "my share" uses `participant_count`.

Rejected: dividing by the current member count (rewrites history when someone joins) and a
per-expense participants table (more rows and writes for a rule that is fully determined by dates).

### Balances (`household_balances` view)

Per member, positive = the household owes them:

- `+ amount` for each expense they paid
- `− amount / participant_count(...)` for each expense they participated in
- `+ amount` for each reimbursement they paid (`paid_by`)
- `− amount` for each reimbursement they received (`paid_to`)

The view uses `security_invoker = true` so it respects RLS.

### Settling (`Saldar`)

Tricount-style running balance. "Settle" creates a `reimbursement` from the member who owes to the
member who is owed, **prefilled with the full pending amount and editable**: settling just the rent
right away is a reimbursement for half the rent; settling at the end of the month is a
reimbursement for whatever is left. There is no month closing: the balance is a running total.
With more than two members, "settle" picks the counterpart explicitly.

### Shared fixed costs

A fixed concept with `is_shared = true` is a cost one member pays for the household (Guido pays
electricity, Sabrina pays internet).

- When its `fixed_entry` gets an amount, a **Postgres trigger** (on `fixed_entries` insert/update/
  delete, `security definer`) creates, updates or deletes the matching `shared_movements` row:
  `kind = expense`, `paid_by = owner`, `description = concept name`, `fixed_entry_id = entry`.
  `occurred_on` = today clamped into the entry's month (`greatest(month, least(current_date,
month + 1 month − 1 day))`), so the movement always falls in the entry's month. Rejected: doing
  it in app code, because two writes from the phone can half-fail and leave the screens out of sync.
- An entry with `amount = null` has no movement. Toggling `is_shared` only affects entries written
  after the change; existing movements stay, because they may already be settled. The fixed screen
  says so when toggling.
- On the owner's **Fixed** screen the row shows the **total and "my share"** (total /
  `participant_count`); the month total adds **only my share**.
- On the other members' **Fixed** screens, shared fixed costs paid by someone else appear as
  **read-only rows** with "paid by X", the total and their share, and their share is added to
  their month total (this is how internet appears in Guido's spreadsheet since August 2026). These
  rows are read from `shared_movements where fixed_entry_id is not null and paid_by <> me` for the
  month, so the private `fixed_*` tables never leak.

### Row Level Security

- `fixed_concepts`, `fixed_entries`, `reference_rates`: only the owner can select/insert/update/
  delete.
- `households`, `household_members`, `shared_movements`: only active members of that household.
  Inserting or updating a `shared_movements` row with a non-null `fixed_entry_id` is denied to
  clients (only the trigger writes them).
- Joining: `join_household(code)` RPC, `security definer`, the only way to insert into
  `household_members` from a client. Creating: `create_household(name)` RPC that also inserts the
  creator as a member.
- The anon key ships inside the APK and is public by design; RLS is the security boundary.
  The service role key is only used by the import script, from `.env`, never committed.

## Screens

Two tabs (`expo-router` tabs), plus sign-in and household setup outside the tabs.

1. **Sign in**: one "Continue with Google" button.
2. **Household setup** (only while the user has no household): create one (shows the invite code
   to share) or join one with a code.
3. **Fixed** (`Fijos`): month selector (previous / next, defaults to the current month); the
   reference rate for that month (editable); one row per active concept (plus archived concepts
   that have an entry that month), each with its amount or "pending"; shared rows show total and
   my share; read-only rows for shared costs paid by others; footer with the month total in ARS
   and USD and how many are still pending. **A new month starts with the same concepts and empty
   amounts — no reference to last month's values.** Manage concepts: add, rename, toggle shared,
   archive. No reordering in v1 (sorted by name).
4. **Shared** (`Compartidos`): modelled on the current Tricount screen — header with "My
   expenses" (my shares) and "Total expenses" for the selected month; balance card ("Sabrina te
   debe $X" / "Le debés $X a Sabrina"); list grouped by day, each row with description, "paid by
   X" or "transferred by X", and amount; floating "add expense" button; "Settle" action. Add/edit
   form: description, amount, date (default today), paid by (default me). Any member can edit or
   delete any manual movement; derived ones link to the fixed screen instead.

## Design and UI copy

T3 produces the visual design with Claude Design (a Design artifact), the maintainer approves it,
and T3 implements the theme and base components. Until then, this section is empty on purpose:
screen tasks (T4–T6) must not invent styles or copy.

### UI copy

_Filled by T3 with every approved string, per screen._

## Spreadsheet import

`tools/excel-import.ts` (T7) loads Guido's history into his account, once:

- Input: the two sheets ("En pesos", "En dolares") exported as CSV into `data/` — **`data/` is
  gitignored: personal financial data never enters the public repo**.
- Month headers have no year; the first column is August 2025 and each next column is the next
  month.
- Every row except `Total` becomes a `fixed_concept` (not shared: history holds Guido's own
  amounts, already halved where it applied). `-` or empty = no entry for that month. Amounts are
  rounded to whole pesos. The `Valor dolar` row becomes `reference_rates`.
- Idempotent: re-running it upserts by (`concept`, `month`), never duplicates.
- Writes with the service role key to the user given by `--email`.

## Distribution

- `eas build --profile preview --platform android` produces an APK; both phones install it from
  the build link.
- EAS Update on the `preview` channel: `eas update --branch preview` ships JS-only changes; a new
  APK is needed only for native changes (new native library, permissions, app config).
- Google Sign-In needs the APK's signing SHA-1 registered on the Android OAuth client in Google
  Cloud; the EAS-managed keystore's SHA-1 comes from `eas credentials`.
