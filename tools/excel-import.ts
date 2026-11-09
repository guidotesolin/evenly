/// <reference types="node" />
// Loads the fixed-cost spreadsheet history into one account (ARCHITECTURE.md § Spreadsheet import):
// `npm run import -- --email <email> --pesos data/pesos.csv --dollars data/dolares.csv`.
// Reads EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env. Idempotent: concepts are
// matched by name, entries upsert by (concept, month) and rates by (owner, month).
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { monthKey } from '../src/lib/fixed.ts';
import type { Database } from '../src/lib/database.types';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export interface SheetRow {
  name: string;
  /** `null`: the cell was empty or `-`. */
  values: { month: string; value: number | null }[];
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
}

// The subset of RFC 4180 Google Sheets writes: quoted fields with commas and "" inside, LF or CRLF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// Headers have no year: the first month column is August 2025 and each next one the next month.
// Columns end at the first header that isn't a month; a month out of order means a moved column.
export function monthColumns(header: string[]): string[] {
  const months: string[] = [];

  for (const cell of header.slice(1)) {
    const name = normalize(cell).replace('setiembre', 'septiembre');

    if (!MONTHS.includes(name)) break;

    const date = new Date(Date.UTC(2025, 7 + months.length, 1));
    const expected = MONTHS[date.getUTCMonth()];

    if (name !== expected) {
      throw new Error(`Column ${months.length + 2}: expected "${expected}", found "${cell}"`);
    }

    months.push(date.toISOString().slice(0, 10));
  }

  return months;
}

// Cells as Google Sheets exports them (US separators): `$1,757,740.11`, `US$ 1,212.50`, `1450`.
// Empty, `-` or the accounting zero `$ -` is `null`.
const cellSchema = z
  .string()
  .trim()
  .pipe(
    z.union([
      z
        .string()
        .regex(/^(US)?\$?\s*-?$/)
        .transform(() => null),
      z
        .string()
        .regex(/^(US)?\$?\s*[\d,]+(\.\d+)?$/)
        .transform((text) => Number(text.replace(/[^\d.]/g, ''))),
    ]),
  );

// One row per concept with a value per month column. Rows before the header (titles) and blank or
// `Total` rows are skipped. With `only`, just that row is read: the dollars sheet's other rows are
// formulas that can export as `#VALUE!`.
export function parseSheet(text: string, only?: string): SheetRow[] {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((row) => normalize(row[1] ?? '') === 'agosto');

  if (headerIndex === -1) throw new Error('No header row starting with "agosto"');

  const months = monthColumns(rows[headerIndex]);
  const sheet: SheetRow[] = [];

  for (const row of rows.slice(headerIndex + 1)) {
    const name = row[0].trim();

    if (name === '' || normalize(name) === 'total') continue;

    if (only !== undefined && normalize(name) !== only) continue;

    const values = months.map((month, i) => {
      const cell = row[i + 1] ?? '';
      const parsed = cellSchema.safeParse(cell);

      if (!parsed.success) throw new Error(`${name}, ${month}: "${cell}" is not an amount`);

      return { month, value: parsed.data };
    });

    sheet.push({ name, values });
  }

  return sheet;
}

// Every pesos row but `Valor dolar` is a concept with amounts rounded to whole pesos. An empty cell
// before `currentMonth` wasn't paid that month and becomes 0 (shown as `-`); from `currentMonth` on
// it stays out, so the app shows it pending. `Valor dolar` (looked up in either sheet) gives the
// reference rates.
export function importPlan(pesos: SheetRow[], dollars: SheetRow[], currentMonth: string) {
  const isRate = (row: SheetRow) => normalize(row.name) === 'valor dolar';
  const rate = [...dollars, ...pesos].find(isRate);

  if (!rate) throw new Error('No "Valor dolar" row in either sheet');

  return {
    concepts: pesos.flatMap((row) =>
      isRate(row)
        ? []
        : [
            {
              name: row.name,
              entries: row.values.flatMap(({ month, value }) => {
                if (value !== null) return [{ month, amount: Math.round(value) }];

                return month < currentMonth ? [{ month, amount: 0 }] : [];
              }),
            },
          ],
    ),
    rates: rate.values.flatMap(({ month, value }) => (value === null ? [] : [{ month, value }])),
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      pesos: { type: 'string' },
      dollars: { type: 'string' },
    },
  });

  const args = z.object({ email: z.email(), pesos: z.string(), dollars: z.string() }).parse(values);

  const env = z
    .object({ EXPO_PUBLIC_SUPABASE_URL: z.url(), SUPABASE_SERVICE_ROLE_KEY: z.string().min(1) })
    .parse(process.env);

  const plan = importPlan(
    parseSheet(readFileSync(args.pesos, 'utf8')),
    parseSheet(readFileSync(args.dollars, 'utf8'), 'valor dolar'),
    monthKey(new Date()),
  );

  const admin = createClient<Database>(
    env.EXPO_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // ponytail: first 1000 users only; paginate listUsers if the project ever has more.
  const users = await admin.auth.admin.listUsers({ perPage: 1000 });

  if (users.error) throw users.error;

  const user = users.data.users.find((u) => u.email?.toLowerCase() === args.email.toLowerCase());

  if (!user) throw new Error(`No user with email ${args.email}`);

  const existing = await admin
    .from('fixed_concepts')
    .select('id, name, is_shared')
    .eq('owner_id', user.id);

  if (existing.error) throw existing.error;

  // History holds the user's own amounts: written into a shared concept, the trigger would turn
  // every past month into a Compartidos expense. Stop before writing anything.
  const shared = existing.data.filter(
    (concept) => concept.is_shared && plan.concepts.some((row) => row.name === concept.name),
  );

  if (shared.length > 0) {
    throw new Error(
      `Shared in the app, unshare or rename first: ${shared.map((c) => c.name).join(', ')}`,
    );
  }

  const ids = new Map(existing.data.map((concept) => [concept.name, concept.id]));
  const missing = plan.concepts.filter((concept) => !ids.has(concept.name));

  if (missing.length > 0) {
    const created = await admin
      .from('fixed_concepts')
      .insert(missing.map((concept) => ({ owner_id: user.id, name: concept.name })))
      .select('id, name');

    if (created.error) throw created.error;

    for (const concept of created.data) ids.set(concept.name, concept.id);
  }

  const entries = plan.concepts.flatMap((concept) => {
    const conceptId = ids.get(concept.name);

    if (conceptId === undefined) throw new Error(`Concept ${concept.name} was not created`);

    return concept.entries.map((entry) => ({ concept_id: conceptId, ...entry }));
  });

  const upserted = await admin
    .from('fixed_entries')
    .upsert(entries, { onConflict: 'concept_id,month' });

  if (upserted.error) throw upserted.error;

  const rates = await admin.from('reference_rates').upsert(
    plan.rates.map((rate) => ({ owner_id: user.id, month: rate.month, ars_per_usd: rate.value })),
    { onConflict: 'owner_id,month' },
  );

  if (rates.error) throw rates.error;

  console.log(
    `${plan.concepts.length} concepts (${missing.length} new), ${entries.length} entries, ` +
      `${plan.rates.length} rates for ${args.email}`,
  );
}

if (import.meta.main) await main();
