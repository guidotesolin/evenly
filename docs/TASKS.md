# Evenly — Task board

> The design and its reasoning live in [ARCHITECTURE.md](./ARCHITECTURE.md). Read it before
> executing any task: the cards here give scope, not the why.

## Workflow

- `main` starts with the skeleton (T0). Every task gets its own branch: `t1-<slug>`, `t2-<slug>`…
  The maintainer creates it, or orders Claude to.
- Each task is executed in an independent session that reads ARCHITECTURE.md and its own card.
  Every card states scope, dependencies and acceptance without relying on any prior conversation.
- Claude does not commit. It proposes the commit message and the ticket description; the
  maintainer reviews and runs it.
- Code is written with ponytail and must pass anti-slop.

## Board

| ID  | Branch              | Depends on |
| --- | ------------------- | ---------- |
| T0  | `main`              | —          |
| T1  | `t1-schema`         | T0         |
| T2  | `t2-auth-household` | T1         |
| T3  | `t3-design`         | T0         |
| T4  | `t4-fixed`          | T2, T3     |
| T5  | `t5-shared`         | T2, T3     |
| T6  | `t6-shared-fixed`   | T4, T5     |
| T7  | `t7-excel-import`   | T1         |
| T8  | `t8-release`        | T6         |

T1 and T3 can run in parallel; so can T4, T5 and T7.

---

### T0 — Skeleton ✅ done

Create the Expo app at the repo root with `create-expo-app` (TypeScript template, `expo-router`)
and **TypeScript strict**. Add `expo-dev-client` (Google Sign-In will not run in Expo Go). Set the
Android package to `ar.tesolin.evenly` and the app name to "Evenly". Add ESLint
(`eslint-config-expo`), Prettier, and **anti-slop** through the `install-anti-slop` skill, with
`no-runtime-typeof` set to `allowInTypeGuards`. Scripts: `lint` (`eslint && oxlint`), `typecheck`
(`tsc --noEmit`), `format:check` (`prettier --check .`). Run `supabase init` (the `supabase/`
folder only, no project linking). Add `.env.example` with `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `SUPABASE_SERVICE_ROLE_KEY`;
`.gitignore` with `.env*` (except `.env.example`) and **`data/`**. Add `.githooks/pre-commit`
(already in the repo; the README says `git config core.hooksPath .githooks`), a GitHub Actions CI
(install, lint, format check, typecheck on push to `main` and on PRs), an MIT `LICENSE`, and a
README with setup steps (Node version, `npm ci`, `.env`, `npx expo run:android` for a dev build).
**Check every free-tier limit in ARCHITECTURE.md `## Cost`** against the providers' current
pricing pages and update the table with what you found and the date.

_Output_: Expo project, configs, CI workflow, LICENSE, README, updated `## Cost`
_Acceptance_: `npm run lint`, `npm run format:check` and `npm run typecheck` pass; `npx expo
run:android` (or `npx expo export --platform android`) builds; `git status` shows no `.env` or
`data/` file; a staged `.env` is rejected by the pre-commit hook
_Commit_: `chore: scaffold expo app with lint, ci and docs`

#### Where it departed from the plan

- Scaffolded from `create-expo-app` (default template, Expo SDK 58) and stripped of the demo
  screens, iOS and web config (`platforms: ["android"]`). `react-dom` stays: `expo-router` needs it
  as a peer.
- The Supabase CLI is a dev dependency (`npx supabase …`) instead of a global install.
- The template's `AGENTS.md` (Expo guidance: read versioned docs, use `npx expo install`) is kept
  and imported from `CLAUDE.md`.
- `tsconfig.json` excludes `tools/oxlint/anti-slop`: the vendored plugin imports `.ts` paths that
  the app's compiler settings reject; oxlint loads it on its own.

#### Verified on delivery

- `npm run lint`, `npm run format:check`, `npm run typecheck`: exit 0. A probe file confirmed
  anti-slop rules fire (`no-unknown-parameters`, `no-array-filter-map`).
- `npx expo export --platform android` produces the Hermes bundle. `npx expo run:android` was
  **not** run: this machine has no Android SDK / `adb` yet.
- Pre-commit hook in a scratch repo: staging `.env` → rejected (exit 1); `.env.example` alone →
  accepted, gitleaks found no leaks.
- Free-tier limits checked and recorded in ARCHITECTURE.md `## Cost`.

---

### T1 — Database schema, RLS and balances

Write the migrations in `supabase/migrations/` for every table, function, trigger and view in
ARCHITECTURE.md `## Data model`: the `profiles` trigger on `auth.users`, `participant_count`, the
`create_household` and `join_household` RPCs, the shared-fixed trigger on `fixed_entries`, the
`household_balances` view (`security_invoker`), and **RLS policies for every table**. Generate
types into `src/lib/database.types.ts` (`supabase gen types typescript --local`). Write
`tools/rls-smoke.ts` (`npm run rls:smoke`) against the local stack (`supabase start`): it creates
three users, puts two in a household, and asserts. Add a CI job that runs `supabase start`,
`supabase db reset` and the smoke.

_Output_: migrations, generated types, `tools/rls-smoke.ts`, CI job
_Acceptance_: `supabase db reset` applies cleanly; `npm run rls:smoke` passes and checks at least:
(1) user A cannot read B's `fixed_*` or `reference_rates`; (2) the third user cannot read the
household's `shared_movements`; (3) A pays 1000 and B pays 400 → balances +300 / −300;
(4) a reimbursement B→A of 300 → both balances 0; (5) a member who joins later does not change
the split of earlier expenses (1000 split by 2, then a third joins, an expense of 900 after the
join splits by 3); (6) giving an amount to a shared fixed entry creates exactly one expense
movement, changing it updates it, setting it to null deletes it; (7) a client cannot insert a
`shared_movements` row with `fixed_entry_id`
_Commit_: `feat(db): add schema, rls policies and balance view`

---

### T2 — Google sign-in and household

Supabase client in `src/lib/supabase.ts` (session persisted with `expo-secure-store` or
AsyncStorage, per Supabase's Expo guide). Google Sign-In with
`@react-native-google-signin/google-signin` and `supabase.auth.signInWithIdToken`. Document in the
README the one-time setup: Google Cloud OAuth clients (Web + Android with the dev and EAS SHA-1s)
and enabling the Google provider in Supabase. Routing: no session → sign-in; session without
household → household setup (create, showing the invite code; or join with a code); otherwise
the two tabs, **Fijos** and **Compartidos**, as empty placeholders. Sign-out lives in a header menu.
Use plain unstyled components; T3 styles them later.

_Output_: auth flow, household setup screen, tab layout, README section
_Acceptance_: on a dev build on a real Android phone, sign in with Google, create a household,
see the code; on a second account, join with that code; both land on the tabs; killing and
reopening the app keeps the session; signing out returns to sign-in
_Commit_: `feat(auth): add google sign-in and household setup`

---

### T3 — Design and implement the look

**Design and execute.** Using Claude Design (create a Design artifact through the Artifact tool's
quickstart with `intent: "design"`), design these screens for an Android phone, dark and light
mode: sign-in, household setup, **Fijos** (month selector, reference rate, concept rows with
amount / pending / shared with total + my share / read-only paid-by-other, month total ARS + USD),
**Compartidos** (modelled on the Tricount screen described in ARCHITECTURE.md, with header totals,
balance card, list by day, floating add button), add/edit expense form, settle sheet, and
manage-concepts. **Every visible string is written in Spanish in the design.** Stop and get the
maintainer's approval of the design before writing code. Then implement: a theme module (colours,
spacing, typography, dark/light from the system), the base components the design repeats
(screen container, money text, row, button, input, month selector) and apply them to the T2
screens if T2 is done. Record every approved string in ARCHITECTURE.md `### UI copy`, per screen,
and the design artifact's link in `## Design and UI copy`.

_Output_: approved design artifact, theme, base components, filled `### UI copy`
_Acceptance_: the maintainer approved the design in this session; `### UI copy` lists all strings
for every screen; a dev build shows the base components in both system themes; lint, format and
typecheck pass
_Commit_: `feat(ui): add design system and base components`

---

### T4 — Fixed screen

Build the **Fijos** tab as specified in ARCHITECTURE.md `## Screens` (3) and the T3 design, using
the T3 components and copy: month selector (default current month), reference rate for the month
(upsert into `reference_rates`), one row per active concept plus archived concepts with an entry
that month, tap a row to enter or clear the amount (upsert into `fixed_entries`), month total in
ARS and USD (no USD when the month has no rate), count of pending rows. **A new month shows the
concepts with empty amounts and no hint of last month's values.** Manage concepts: add, rename,
archive. Sorted by name. Shared concepts and the read-only rows are T6, not this task: here
`is_shared` is ignored. Put the month-total and USD calculation in a pure function with a smoke
(`npm run fixed:smoke`).

_Output_: Fijos screen, concept management, `tools/fixed-smoke.ts`
_Acceptance_: `npm run fixed:smoke` passes (total ignores pending rows; USD = ARS / rate with 2
decimals; no rate → no USD); on the phone: enter a rate and three amounts, leave one pending, the
total and the pending count are right; go to next month → same concepts, all empty; archive a
concept → it disappears from future months but stays in months that have an entry
_Commit_: `feat(fixed): add monthly fixed costs screen`

---

### T5 — Shared screen

Build the **Compartidos** tab as specified in ARCHITECTURE.md `## Screens` (4), `### Balances`
and `### Settling`, with the T3 design and copy: month selector, header with "my expenses" (sum of
my shares) and "total expenses" for the month, balance card from `household_balances`, list
grouped by day (expenses show "paid by X", reimbursements "transferred by X"), add/edit/delete
expense form (description, amount, date default today, paid by default me), and **Settle**:
prefilled with the full pending amount, editable, creates a `reimbursement` from debtor to
creditor. Movements with `fixed_entry_id` open as read-only with a note that they are edited from
Fijos (they won't exist until T6).

_Output_: Compartidos screen, expense form, settle flow
_Acceptance_: with both phones: A adds an expense of 20.000, B sees it and the balance "B owes
10.000"; B settles 4.000 → balance 6.000; B settles the rest → 0 and a reimbursement row appears
under today; editing and deleting a manual expense updates both phones' balance after refresh
_Commit_: `feat(shared): add shared expenses screen with settle`

---

### T6 — Shared fixed costs

Connect both screens as specified in ARCHITECTURE.md `### Shared fixed costs`: in concept
management, a "shared" toggle (with the note that it applies only from now on); shared rows show
total and my share (`amount / participant_count`), and the month total adds only my share;
read-only rows for shared fixed costs paid by other members, read from `shared_movements`, with
their share added to the total. The derived expense appears on Compartidos ("Luz, paid by
Guido") through the T1 trigger — no extra writes from the app.

_Output_: changes to Fijos and concept management
_Acceptance_: on two phones: Guido marks "Luz" as shared and enters 26.000 → Guido's Fijos shows
26.000 / my share 13.000 and the total adds 13.000; Compartidos on both phones shows "Luz, pagado
por Guido" 26.000 and the balance moves by 13.000; Sabrina's Fijos shows a read-only Luz row with
her 13.000 in her total; Guido changes it to 30.000 → all three places update; Guido clears the
amount → the movement disappears
_Commit_: `feat(fixed): split shared fixed costs into the household`

---

### T7 — Spreadsheet import

`tools/excel-import.ts` (`npm run import -- --email <email> --pesos data/pesos.csv --dollars
data/dolares.csv`) as specified in ARCHITECTURE.md `## Spreadsheet import`: parse both CSVs with
Zod at the boundary, map columns to months starting August 2025, skip `Total`, skip `-` / empty
cells, round amounts, upsert concepts (not shared), entries and rates with the service role key.
Idempotent. Parsing and month mapping live in pure functions covered by `npm run import:smoke`,
with a tiny fixture inline in the smoke (no real data in the repo). **`data/` stays gitignored.**
Document in the README how to export each sheet as CSV.

_Output_: `tools/excel-import.ts`, `tools/import-smoke.ts`, README section
_Acceptance_: `npm run import:smoke` passes (header "agosto … agosto" maps to 2025-08 … 2026-08;
`$1,757,740.11` → 1757740; `-` → no entry; `Valor dolar` → rate); against the local stack, a
real import creates 14 concepts and 15 months of entries and rates for the user, and running it
twice leaves the same row counts; `git status` shows nothing under `data/`
_Commit_: `feat(import): import fixed cost history from spreadsheet`

---

### T8 — Release: APK and OTA updates

Add `eas.json` with a `preview` profile (`buildType: apk`, channel `preview`) and configure
`expo-updates`. Create the hosted Supabase project, run the migrations against it, and point the
preview build's env at it (EAS environment variables, never committed). Register the EAS
keystore's SHA-1 on the Google Android OAuth client. Build, install on both phones, run the
import (T7) for Guido against production. Document in the README: building, installing,
publishing an update (`eas update --branch preview`), and when a new APK is needed instead.

_Output_: `eas.json`, updates config, README distribution section
_Acceptance_: both phones install the APK and sign in; a visible JS-only change published with
`eas update --branch preview` reaches both phones after reopening the app, without reinstalling;
Guido's Fijos shows the imported history; lint, format and typecheck pass
_Commit_: `chore(release): add eas build and update for android`

---

## Backlog

Things found while executing the board and deliberately left. Each one says why it was left and
who it belongs to. Shortcuts inside code are `ponytail:` comments instead.

| ID  | What                                    | Why it was left                                             | Belongs to                          |
| --- | --------------------------------------- | ----------------------------------------------------------- | ----------------------------------- |
| B1  | Import Sabrina's fixed-cost spreadsheet | Not known yet whether she has one; T7's script may cover it | When Sabrina shares her spreadsheet |
