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

### T1 — Database schema, RLS and balances ✅ done

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

#### Where it departed from the plan

- The equal-split rule lives in `household_participants(household, date)`; `participant_count`
  counts it, and the balance view joins it to find who shares each expense.
- Smokes run on Node 24's built-in type stripping (`node tools/rls-smoke.ts`), not `tsx`: no extra
  dependency. `@types/node` (pinned to 24) is a dev dependency, referenced from the smoke file.
- The shared-fixed trigger fires on insert and on `amount` updates. Deleting an entry (or its
  concept) removes the movement through `on delete cascade` on `fixed_entry_id`, not a delete
  trigger. A movement keeps its first `occurred_on` and description; only the amount follows.
- Extra integrity the plan didn't list: months must be the first of the month, amounts are
  non-negative (movements positive), reimbursements need a `paid_to` other than `paid_by`, and
  `paid_by` / `paid_to` must be active members of the household.
- `npm run db:types` regenerates `src/lib/database.types.ts`; the file is excluded from Prettier.
  CLI v3 makes `--local` the default, so the script omits it.
- Local stack and CI start Supabase without studio, storage, realtime, edge runtime, analytics,
  mailpit and the pooler: only auth, PostgREST and Postgres are needed.

#### Verified on delivery

- `npx supabase db reset` applies the migration cleanly; `npm run rls:smoke` prints `ok 1` … `ok 7`
  for the seven acceptance checks.
- `npm run lint`, `npm run format:check`, `npm run typecheck`: exit 0.
- The CI `db` job was **not** run: nothing was pushed.

---

### T2 — Google sign-in and household ✅ done

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

#### Where it departed from the plan

- Session storage is `expo-secure-store` straight (no AsyncStorage): Android has no value size
  limit, and the app is Android-only. The AES wrapper from Supabase's guide is only needed if iOS
  ever ships (`ponytail:` comment in `src/lib/supabase.ts`).
- The Google Sign-In config plugin is **not** in `app.json`: without Firebase it only edits the
  iOS Info.plist, and with no options it demands `google-services.json`. On Android the module
  autolinks and needs nothing else.
- Routing uses `Stack.Protected` guards in the root layout over an `AuthProvider` (session from
  `onAuthStateChange`, household from `household_members where left_on is null`). The splash
  stays up until both are known. After creating a household, the screen shows the invite code
  with a "Continuar" button before the guard moves to the tabs.
- The header menu is a native `Alert` with "Cerrar sesión" (`ponytail:` comment); T3 picks the
  real menu component. Sign-out also calls `GoogleSignin.signOut()` so the next sign-in shows the
  account picker.
- `supabase/config.toml` enables the Google provider for the local stack, reading the Web client
  ID from `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` at `supabase start` (unset, the stack still starts).
- No smoke: the task is glue around Supabase and the Google SDK, with no pure logic to check.

#### Verified on delivery

- `npm run lint`, `npm run format:check`, `npm run typecheck`: exit 0.
- `npx expo export --platform android` produces the Hermes bundle with the new routes.
- `npx supabase start` with and without `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` set; the auth container
  receives the substituted client ID; `npm run rls:smoke` still prints `ok 1` … `ok 7`.
- On a Redmi Note 15 (dev build over wireless `adb`, local stack reached at the LAN IP): signed in
  with Google, created a household and saw its invite code, landed on the tabs; killing and
  reopening the app kept the session; "Cerrar sesión" returned to sign-in; a second Google
  account joined with the code and landed on the tabs. The database shows both accounts as active
  members of the same household.
- The README's first draft pointed at `~/.android/debug.keystore` for the dev SHA-1; Expo signs
  the dev build with the template's `android/app/debug.keystore`. Fixed during acceptance.

---

### T3 — Design and implement the look ✅ done

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

#### Where it departed from the plan

- Two screens the card did not list were designed because T4 needs them: the Fijos amount sheet
  and the "group created" state of household setup.
- The maintainer asked for an optional **emoji per fixed concept** during review. It is in the
  design and the copy; the `fixed_concepts.emoji` migration moved to T4, which owns concepts.
- `Card` joined the base components: the design repeats it (household, totals, rate).
- Tabs are label-only: the design draws icons, but no icon library is installed (`ponytail:` in
  `src/app/(tabs)/_layout.tsx`).
- No `money:smoke`: `src/lib/money.ts` is two `Intl.NumberFormat` calls and a null guard; its
  output (`$ 1.495.000`, `US$ 1.031,03`) was checked in Node. T4's `fixed:smoke` will exercise it.
- The Fijos tab shows a preview of `MonthSelector`, `Row` and `Money` until T4 replaces it, so
  the components can be checked on a dev build.

#### What ran

- `npm run lint`, `npm run format:check`, `npm run typecheck`: exit 0.
- `npx expo export --platform android`: Hermes bundle built.
- On the Redmi Note 15 (dev build, Metro reload): sign-in, tabs and the Fijos preview checked by
  the maintainer in light and dark system themes.

---

### T4 — Fixed screen ✅ done

Build the **Fijos** tab as specified in ARCHITECTURE.md `## Screens` (3) and the T3 design, using
the T3 components and copy: month selector (default current month), reference rate for the month
(upsert into `reference_rates`), one row per active concept plus archived concepts with an entry
that month, tap a row to enter or clear the amount (upsert into `fixed_entries`), month total in
ARS and USD (no USD when the month has no rate), count of pending rows. **A new month shows the
concepts with empty amounts and no hint of last month's values.** Manage concepts: add, rename,
archive, and an optional emoji per concept (migration adding `fixed_concepts.emoji`, see
ARCHITECTURE.md § Design and UI copy). Sorted by name. Shared concepts and the read-only rows are T6, not this task: here
`is_shared` is ignored. Put the month-total and USD calculation in a pure function with a smoke
(`npm run fixed:smoke`).

_Output_: Fijos screen, concept management, `tools/fixed-smoke.ts`
_Acceptance_: `npm run fixed:smoke` passes (total ignores pending rows; USD = ARS / rate with 2
decimals; no rate → no USD); on the phone: enter a rate and three amounts, leave one pending, the
total and the pending count are right; go to next month → same concepts, all empty; archive a
concept → it disappears from future months but stays in months that have an entry
_Commit_: `feat(fixed): add monthly fixed costs screen`

#### Where it departed from the plan

- `src/lib/fixed.ts` holds the pure pieces (`summarizeMonth`, `parseWholeNumber`, `monthKey`,
  `monthLabel`). The USD estimate stays in T3's `formatUsd`; `fixed:smoke` checks both.
  `tsconfig.json` gains `allowImportingTsExtensions` so smokes can import `src/` with `.ts` paths
  under Node's type stripping.
- `Sheet` (bottom sheet on a native `Modal`) joined the base components: amount, rate and rename
  use it, and T5's settle sheet can too.
- "Dejar pendiente" upserts `amount = null` instead of deleting the entry; both read as pending.
  An archived concept stays in every month where it has an entry, pending included, so an
  amount cleared by mistake can be entered again.
- Amounts and the rate take whole pesos in `es-AR` style: dots group thousands, a typed comma
  is ignored and pasted cents are dropped (`$1.757.740,51` is 1757740, not ×100 or rounded up). Both inputs group thousands while typing
  (`groupThousands`, from the phone check: 100000 and 1000000 looked alike).
- An `ARS | USD` switch in the rate card shows rows and total as USD estimates (asked during the
  phone check; display only, not remembered). Every USD value carries `≈` (`formatUsd`). `Money` takes an optional `usdRate`.
- Emoji and name are edited together in one sheet, `Editar concepto` (new copy, replacing the
  design's `Renombrar concepto`), opened from the circle or the pencil. Saving on Guardar, not
  on blur, means leaving the screen never drops an edit. No single-grapheme check on the emoji
  (`ponytail:` in `src/app/concepts.tsx`); `fixed_concepts.emoji` rejects `''`.
- Rename, archive, back, month arrows and the menu share `IconButton` (Unicode glyphs ✎ ⊖ ← ‹ ›
  ⋮, like the label-only tabs). The back button on Conceptos is a custom `headerLeft`: the
  native one can't carry the `Volver` label.
- Changing month keeps the previous month on screen, dimmed and read-only, until the new one
  arrives; late responses for another month are dropped. Pull to refresh reloads the month and
  is the retry after a failed load. Writes ignore a second tap while one is in flight.
- The "Compartido" switch, its note and the amount sheet's shared hint are left for T6.

#### What ran

- `npx supabase db reset` applies both migrations; `npm run db:types` regenerated the types.
- `npm run fixed:smoke`: `ok fixed`. `npm run rls:smoke`: `ok 1` … `ok 7`.
- Code review (high) found 10 issues; all applied. Re-ran the smokes, lint, format, typecheck,
  the Android export, and the throwaway DB script for the new archived filter (a pending entry
  keeps an archived concept in its month only).
- A throwaway script against the local stack (deleted after) ran the screen's exact queries:
  four amounts entered and one left pending read back right; upserting the rate twice keeps one
  row; the next month lists the same concepts with no amounts and no rate; archiving a concept
  with an amount keeps it in that month only, archiving a pending one hides it everywhere.
- `npm run lint`, `npm run format:check`, `npm run typecheck`: exit 0.
- `npx expo export --platform android`: Hermes bundle built.
- Phone acceptance by the maintainer on the Redmi: rate, amounts with pending ones, next month,
  archive; the sheets sit right above the keyboard. The thousands grouping, the `ARS | USD`
  switch, `≈` on USD, capitalized months, no cents and the empty-rate label came from that check.
- `db reset` wiped the T2 account and household on the local stack; new migrations go through
  `npx supabase migration up`, which keeps the data.

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
