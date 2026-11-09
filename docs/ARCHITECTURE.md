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
| `fixed_concepts`    | `owner_id`, `name`, `emoji` (text, null; added by T4), `is_shared` (bool), `archived_at` (null)                                                                                          | Private to the owner                                                                                            |
| `fixed_entries`     | `concept_id`, `month` (date), `amount` (bigint, **null = pending**, 0 = not paid that month); unique (`concept_id`, `month`)                                                             | Private to the owner (through the concept)                                                                      |
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

The Compartidos header's "my expenses" reads `my_share`, a PostgREST computed field on
`shared_movements` (`select('*, my_share')`): the caller's share of an expense through
`household_participants` / `participant_count`, 0 for reimbursements and for expenses the caller
didn't take part in. The app never repeats the split rule.

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
- An entry with `amount = null` or `0` (not paid that month) has no movement
  (`20261110000000_zero_amount_no_movement.sql`), so a skipped month never shows as a $0 expense. Toggling `is_shared` only affects entries written
  after the change; existing movements stay, because they may already be settled. The fixed screen
  says so when toggling.
- On the owner's **Fixed** screen the row shows the **total and "my share"** (total /
  `participant_count`); the month total adds **only my share**.
- On the other members' **Fixed** screens, shared fixed costs paid by someone else appear as
  **read-only rows** with "paid by X", the total and their share, and their share is added to
  their month total (this is how internet appears in Guido's spreadsheet since August 2026). These
  rows are read from `shared_movements where fixed_entry_id is not null and paid_by <> me` for the
  month, so the private `fixed_*` tables never leak.
- A shared concept is a monthly household cost, so while its owner hasn't entered the month's
  amount it shows as a **pending read-only row** ("paga X") on the other members' Fixed screens
  and counts in their pending total. Those rows come from `pending_shared_concepts(month)`, a
  `security definer` function that returns only the name and owner of the active, shared,
  non-archived concepts of the caller's household members with no amount that month; nothing
  else of `fixed_*` is exposed. Known ceiling: there is no record of when a concept became
  shared, so one shared today also shows as pending in past months.

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
   archive, unarchive. No reordering in v1 (sorted by name). **Evolución** (from the menu): every
   month's total, newest first, with a bar per month and the USD estimate where the month has a
   rate, the current month marked as in progress (grey bar) since it still has pending amounts; the same sum as the footer (`monthlyTotals` in `src/lib/fixed.ts`).
4. **Shared** (`Compartidos`): modelled on the current Tricount screen — header with "My
   expenses" (my shares) and "Total expenses" for the selected month; balance card ("Sabrina te
   debe $X" / "Le debés $X a Sabrina"); list grouped by day, each row with description, "paid by
   X" or "transferred by X", and amount; floating "add expense" button; "Settle" action. Add/edit
   form: description, amount, date (default today), paid by (default me). Any member can edit or
   delete any manual movement; derived ones link to the fixed screen instead.
5. **Menu** (`⋮` in both tabs, a bottom sheet): **Grupo familiar** (a screen with the household
   name, its active members and the invite code, shared through Android's share sheet),
   **Evolución de fijos** (kept out of the Fijos header, which had no room for a second action), **Tema**
   (Sistema / Claro / Oscuro), **Cerrar sesión**, and the app version.

## Design and UI copy

Design artifact (Claude Design, approved by the maintainer on 2026-11-04):
https://claude.ai/artifact/LX5hfdkFvREnSvuWH2azWt — private to the maintainer; share it from the
artifact's Share menu.

Look ("Libreta"): quiet surfaces, big tabular numbers, one blue accent and orange for what is
pending or owed (blue/orange rather than green/red, so it reads with colour blindness). Roboto,
Android's system font, so no font is bundled. Light and dark follow the system
(`userInterfaceStyle: automatic` + `useColorScheme`) unless the menu's Tema overrides it:
`Appearance.setColorScheme`, so native dialogs follow too, with the choice kept in SecureStore and
applied at startup.

- **Theme**: `src/theme.ts` — colours (`useColors()`), `space`, `radius`, `touch` (48),
  `type` scale, and `useNavigationTheme()` for headers and tab bar. Every colour pair passes 4.5:1.
- **Base components**: `src/components/ui.tsx` — `Screen`, `Card`, `Money`, `Row`, `Button`
  (`primary` | `secondary` | `text` | `danger`), `Input` (labelled), `MonthSelector`, `Sheet`
  (bottom sheet with title and subtitle), `IconButton` (48 dp glyph button with a label),
  `DaySelector` (the `Fecha` field: opens Android's calendar dialog,
  `@react-native-community/datetimepicker`, never past today). `Row` takes an optional `badge` (`Fijo`). Screens compose these; they do not style raw
  primitives.
- **Money formatting**: `src/lib/money.ts` — `formatArs` (`$ 1.495.000`) and `formatUsd`
  (`≈ US$ 1.031,03`, always with `≈` since amounts are stored in pesos; `null` without a rate).
- **Concept emoji**: each fixed concept may have an emoji (🚗 Auto), chosen with the phone's emoji
  keyboard. Without one, the row shows the name's initial. Read-only rows (shared costs paid by
  someone else) always show the initial: the other member's concepts are private. Needs
  `fixed_concepts.emoji` (see Data model).
- **Tab icons**: the design draws them; v1 ships label-only tabs to avoid an icon dependency
  (`ponytail:` in `src/app/(tabs)/_layout.tsx`).

### UI copy

Every visible string, per screen. Screen tasks use these verbatim; a new string is added here in
the same change. `{x}` marks a value. Dates use `es-AR` (`lunes 2 de noviembre`); the month
selector shows `Noviembre 2026` (capitalized, as a title).

**Sign in**

- `Evenly` · `Los gastos de la casa, en un solo lugar.`
- Button: `Continuar con Google` · hint: `Usá tu cuenta de Google. No hace falta contraseña.`
- Error: `No se pudo iniciar sesión`

**Household setup**

- `Tu grupo familiar` · `Creá un grupo nuevo o unite a uno con el código que te pasaron.`
- `Crear un grupo nuevo` · field `Nombre del grupo` (placeholder `Ej.: Casa`) · button
  `Crear grupo`
- `o`
- `Unirme con un código` · field `Código de invitación` (placeholder `ABC123`) · button `Unirme`
- Created: `Grupo creado` · `Compartí este código para que se unan:` · `Código de invitación` ·
  `Mantené presionado para copiarlo.` · button `Continuar`
- Errors: `No se pudo crear el grupo`, `No se pudo unir al grupo`, `Error`

**Tabs and menu**

- Tabs: `Fijos`, `Compartidos`
- Menu (`⋮`, accessibility label `Menú`): sheet title `Evenly` · `Grupo familiar` · `Evolución de fijos` · `Tema` with
  `Sistema`, `Claro`, `Oscuro` · button `Cerrar sesión` · `Versión {version}` (plus ` · {update id, 8 chars}` when running an OTA update); error
  `No se pudo cerrar sesión`
- Month selector accessibility labels: `Mes anterior`, `Mes siguiente`

**Fijos**

- Header action: `Conceptos`
- Rate card: `Dólar de referencia` · `{$ rate}`; without a rate, the same
  `Dólar de referencia` as a call to action
- Currency switch in the rate card (only with a rate; display only, amounts are typed in pesos):
  `ARS` · `USD` (a11y: `Ver en pesos` · `Ver en dólares`). In `USD` the rows and total show the
  estimate (`≈ US$ …`) and the line under the total shows the pesos.
- Row details: `Compartido · total {$ total}` with `tu parte` under the amount; read-only:
  `Pagó {name} · total {$ total}`, or `Paga {name}` while it has no amount; no amount:
  `Pendiente`; amount 0 (not paid that month, e.g. skipped the gym; typed as `0`): `-`, a11y
  `No se pagó`, neither pending nor added
- Footer: `Total del mes` · `{$ total}` · `≈ {US$ total}` (omitted without a rate) ·
  `{n} pendiente` / `{n} pendientes`
- Amount sheet: title `{emoji} {concept}` · `{month} · Compartido` (or just `{month}`) · field
  `Monto` · switch `Compartido` (same as in Conceptos) · shared hint `Al ser compartido, se suma a Compartidos como gasto pagado por vos. Tu
parte: {$ share}.` · buttons `Dejar pendiente`, `Guardar`
- Rate sheet: title `Dólar de referencia` · `{month}` · field `Pesos por dólar` · button `Guardar`

**Conceptos**

- Title `Conceptos` · back accessibility label `Volver`
- New: field `Emoji` · field `Nuevo concepto` (placeholder `Ej.: Gimnasio`) · button `Agregar`
- Row: switch `Compartido` · accessibility labels `Compartido: {name}`, `Cambiar emoji de {name}`,
  `Renombrar {name}`, `Archivar {name}`
- Notes: `Un concepto compartido es un gasto que pagás vos para la casa: cada monto que cargues
aparece en Compartidos. Cambiarlo afecta solo los montos que cargues desde ahora.` ·
  `Tocá el círculo para elegir un emoji. Es opcional: sin emoji se muestra la inicial.`
- Edit sheet (opened from the circle or the pencil): `Editar concepto` · fields `Emoji`,
  `Nombre` · button `Guardar`
- Archive confirm: `¿Archivar {name}?` · `Deja de aparecer en los meses nuevos. Los montos
cargados se conservan.` · `Archivar`, `Cancelar`
- Archived section: `Archivados` · button `Desarchivar`

**Compartidos**

- Totals: `Mis gastos` · `Gastos totales`
- Balance card: `{name} te debe` / `Le debés {$ amount} a {name}` / `Están a mano` · button
  `Saldar`
- Day headers: `Hoy`, `Ayer`, then the date (`lunes 2 de noviembre`)
- Row details: `Pagaste vos`, `Pagó {name}`, `Transferiste vos`, `Te transfirió {name}`; derived
  rows carry the chip `Fijo`; a settle row's description is `Reembolso`
- Floating button: `Agregar gasto`
- Tapping a reimbursement: `¿Eliminar este reembolso?` · `Eliminar`, `Cancelar`

**Evolución**

- Title `Evolución` · back accessibility label `Volver`
- Row: `{Month YYYY}` · `{$ total}` · `{≈ US$ total}` (omitted without a rate); the current
  month adds `· En curso`; accessibility label `{Month YYYY}: {$ total}` (`{Month YYYY}, en curso:
{$ total}`)
- Empty: `Todavía no hay montos cargados.`

**Grupo familiar**

- Title `Grupo familiar` · back accessibility label `Volver`
- `{household name}` · `Integrantes` · rows `{name}`, mine `{name} (vos)`
- `Código de invitación` · `{code}` · `Mantené presionado para copiarlo.` · button
  `Compartir código`, which shares `Sumate a {household name} en Evenly con el código {code}`

**Expense form**

- Titles `Nuevo gasto` / `Editar gasto` · close accessibility label `Cerrar`
- Fields `Descripción` (placeholder `Ej.: Supermercado`), `Monto`, `Fecha` (default `Hoy`;
  accessibility label `Fecha: {Hoy | Ayer | date}`; calendar dialog buttons `Aceptar`,
  `Cancelar`), `Pagó` with `Vos` / `{name}`
- Derived movement (read-only): `Viene de Fijos: se edita desde ahí.`
- A date with nobody in the household (before it existed): `Esa fecha es anterior al grupo:
elegí otra.` (Guardar stays disabled)
- Saving or deleting an expense another phone already deleted: `Error` · `Este gasto ya no
existe.`
- Hint: `Se divide en partes iguales: {$ share} cada uno.`
- Buttons `Guardar`, `Eliminar gasto` · confirm `¿Eliminar este gasto?` · `Eliminar`, `Cancelar`

**Settle sheet**

- `Saldar` · `Registrá lo que {name} te transfirió.` (when I owe: `Registrá lo que le
transferiste a {name}.`)
- Field `Monto` (prefilled with the pending balance) · hint `Saldo pendiente: {$ balance}. Podés
saldar una parte y el resto queda pendiente.` · field `Fecha` (`Hoy`)
- Buttons `Cancelar`, `Registrar transferencia`

## Spreadsheet import

`tools/excel-import.ts` (T7) loads Guido's history into his account, once:

- Input: the two sheets ("En pesos", "En dolares") exported as CSV into `data/` — **`data/` is
  gitignored: personal financial data never enters the public repo**.
- Month headers have no year; the first column is August 2025 and each next column is the next
  month.
- Every row except `Total` becomes a `fixed_concept` (not shared: history holds Guido's own
  amounts, already halved where it applied). `-` or empty before the current month = 0 (not paid);
  from the current month on = no entry (pending in the app). Those zeros only fill months with
  no entry, so a later re-run never blanks an amount typed in the app. Amounts are
  rounded to whole pesos. The `Valor dolar` row becomes `reference_rates`.
- Idempotent: re-running it upserts by (`concept`, `month`), never duplicates. Concepts are
  matched by exact name among the user's concepts (archived included), so ones created in the app
  are reused. A match with a shared concept stops the run before writing: the trigger would turn
  every past month into a Compartidos expense.
- Cells use the US separators Google Sheets exports (`$1,757,740.11`): thousands need commas and
  decimals stop at two digits, so es-AR `1.450` fails rather than importing 1.45; anything else fails the run
  naming the row and month. A month header out of sequence also fails, rather than shifting every
  amount. `Valor dolar` is read from whichever sheet has it, and it is the only row read from the
  dollars sheet (the rest are formulas that can export as `#VALUE!`); rates keep their decimals.
- Writes with the service role key to the user given by `--email`.

## Distribution

- `eas build --profile preview --platform android` produces an APK; both phones install it from
  the build link.
- EAS Update on the `preview` channel: `eas update --branch preview` ships JS-only changes; a new
  APK is needed only for native changes (new native library, permissions, app config).
- `runtimeVersion` uses the `appVersion` policy: bumping `version` in `app.json` is what marks a
  native change, so an update never lands on an APK with different native code. Rejected:
  `fingerprint`, automatic but opaque when a hash differs between this machine and EAS.
- The preview build and its updates read `EXPO_PUBLIC_*` from EAS's `preview` environment (plain
  text: they ship inside the APK anyway), pointing at the hosted Supabase project; `.env` stays
  local and is never uploaded (gitignored files are left out of the EAS build archive).
- Google Sign-In needs the APK's signing SHA-1 registered in Google Cloud. An Android OAuth client
  holds one fingerprint, so there are two with the same package: one with the debug keystore's
  SHA-1 (dev build) and one with the EAS-managed keystore's (expo.dev → Credentials → Android).
  Never replace the first: the dev build would stop signing in.
- EAS manages the Android `versionCode` (`appVersionSource: remote`, `autoIncrement` on the
  `preview` profile), so every APK gets a higher one without touching `app.json`; `version` stays
  the user-facing number and drives `runtimeVersion`.
