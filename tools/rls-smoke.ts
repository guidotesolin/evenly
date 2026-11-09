/// <reference types="node" />
// RLS and balance checks against the local stack: `npx supabase start`, `npx supabase db reset`,
// then `npm run rls:smoke`. Every run uses fresh users, so it can be repeated without a reset.
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/database.types';

type Client = ReturnType<typeof createClient<Database>>;

const status: Record<string, string> = JSON.parse(
  execSync('npx supabase status -o json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
);

const url = status.API_URL;
const admin = createClient<Database>(url, status.SERVICE_ROLE_KEY);

async function signUp(name: string): Promise<{ client: Client; id: string }> {
  const email = `${name}-${crypto.randomUUID()}@example.test`;
  const password = crypto.randomUUID();

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (created.error) throw created.error;
  const client = createClient<Database>(url, status.ANON_KEY, { auth: { persistSession: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });

  if (signedIn.error) throw signedIn.error;

  return { client, id: created.data.user.id };
}

async function balances(client: Client, household: string): Promise<Record<string, number>> {
  const { data, error } = await client
    .from('household_balances')
    .select('user_id, balance')
    .eq('household_id', household);

  if (error) throw error;

  return Object.fromEntries(data.map((row) => [row.user_id, Math.round(Number(row.balance))]));
}

async function addMovement(
  client: Client,
  movement: Database['public']['Tables']['shared_movements']['Insert'],
): Promise<void> {
  const { error } = await client.from('shared_movements').insert(movement);

  if (error) throw error;
}

const a = await signUp('Ana');
const b = await signUp('Beto');
const c = await signUp('Caro');

const household = await a.client.rpc('create_household', { household_name: 'Casa' });

if (household.error) throw household.error;

const householdId = household.data.id;
const joined = await b.client.rpc('join_household', { code: household.data.invite_code });

if (joined.error) throw joined.error;

// Members created today; move A and B back so earlier-dated expenses have participants.
const backdated = await admin
  .from('household_members')
  .update({ joined_on: '2026-01-01' })
  .eq('household_id', householdId);

if (backdated.error) throw backdated.error;

// (1) B cannot read A's fixed costs or reference rates.
const concept = await a.client
  .from('fixed_concepts')
  .insert({ name: 'Alquiler' })
  .select()
  .single();

if (concept.error) throw concept.error;

const entry = await a.client
  .from('fixed_entries')
  .insert({ concept_id: concept.data.id, month: '2026-02-01', amount: 500000 })
  .select()
  .single();

if (entry.error) throw entry.error;

const rate = await a.client
  .from('reference_rates')
  .insert({ month: '2026-02-01', ars_per_usd: 1450 });

if (rate.error) throw rate.error;

for (const table of ['fixed_concepts', 'fixed_entries', 'reference_rates'] as const) {
  const seen = await b.client.from(table).select('id');
  assert.deepEqual(seen.data, [], `B reads A's ${table}`);
}

console.log('ok 1 fixed_* and reference_rates are private');

// (2) A user outside the household cannot read its movements.
await addMovement(a.client, {
  household_id: householdId,
  kind: 'expense',
  paid_by: a.id,
  description: 'Verdulería',
  amount: 1000,
  occurred_on: '2026-02-01',
});

const outsider = await c.client.from('shared_movements').select('id');

assert.deepEqual(outsider.data, [], 'outsider reads shared_movements');

console.log('ok 2 shared_movements hidden from non-members');

// (3) A paid 1000 (above), B pays 400 -> +300 / -300.
await addMovement(b.client, {
  household_id: householdId,
  kind: 'expense',
  paid_by: b.id,
  description: 'Super',
  amount: 400,
  occurred_on: '2026-02-01',
});

assert.deepEqual(await balances(b.client, householdId), { [a.id]: 300, [b.id]: -300 });

console.log('ok 3 balances +300 / -300');

// (4) B reimburses A 300 -> 0 / 0.
await addMovement(b.client, {
  household_id: householdId,
  kind: 'reimbursement',
  paid_by: b.id,
  paid_to: a.id,
  description: 'Saldar',
  amount: 300,
  occurred_on: '2026-02-01',
});

assert.deepEqual(await balances(a.client, householdId), { [a.id]: 0, [b.id]: 0 });

console.log('ok 4 reimbursement settles to 0');

// (5) 1000 before C joins splits by 2; 900 after C joins splits by 3.
await addMovement(a.client, {
  household_id: householdId,
  kind: 'expense',
  paid_by: a.id,
  description: 'Antes',
  amount: 1000,
  occurred_on: '2026-02-01',
});

const cJoined = await c.client.rpc('join_household', { code: household.data.invite_code });

if (cJoined.error) throw cJoined.error;

await addMovement(a.client, {
  household_id: householdId,
  kind: 'expense',
  paid_by: a.id,
  description: 'Después',
  amount: 900,
});

assert.deepEqual(await balances(c.client, householdId), {
  [a.id]: 500 + 600,
  [b.id]: -500 - 300,
  [c.id]: -300,
});

console.log('ok 5 later member does not change earlier splits');

// (6) A shared fixed entry keeps exactly one derived movement in sync.
const shared = await a.client
  .from('fixed_concepts')
  .insert({ name: 'Luz', is_shared: true })
  .select()
  .single();

if (shared.error) throw shared.error;

async function derived(entryId: string): Promise<{ amount: number; kind: string }[]> {
  const { data, error } = await b.client
    .from('shared_movements')
    .select('amount, kind')
    .eq('fixed_entry_id', entryId);

  if (error) throw error;

  return data;
}

const sharedEntry = await a.client
  .from('fixed_entries')
  .insert({ concept_id: shared.data.id, month: '2026-03-01', amount: 26000 })
  .select()
  .single();

if (sharedEntry.error) throw sharedEntry.error;

assert.deepEqual(await derived(sharedEntry.data.id), [{ amount: 26000, kind: 'expense' }]);

const changed = await a.client
  .from('fixed_entries')
  .update({ amount: 30000 })
  .eq('id', sharedEntry.data.id);

if (changed.error) throw changed.error;

assert.deepEqual(await derived(sharedEntry.data.id), [{ amount: 30000, kind: 'expense' }]);

const cleared = await a.client
  .from('fixed_entries')
  .update({ amount: null })
  .eq('id', sharedEntry.data.id);

if (cleared.error) throw cleared.error;

assert.deepEqual(await derived(sharedEntry.data.id), []);

console.log('ok 6 shared fixed entry creates, updates and deletes its movement');

// (7) Clients cannot write trigger-owned movements.
const forged = await a.client.from('shared_movements').insert({
  household_id: householdId,
  kind: 'expense',
  paid_by: a.id,
  description: 'Forged',
  amount: 1,
  fixed_entry_id: entry.data.id,
});

assert.equal(forged.error?.code, '42501', 'client inserted a movement with fixed_entry_id');

console.log('ok 7 fixed_entry_id is trigger-only');

// (8) pending_shared_concepts exposes only the other members' shared concepts with no amount.
const water = await a.client
  .from('fixed_concepts')
  .insert({ name: 'Agua', is_shared: true })
  .select()
  .single();

if (water.error) throw water.error;

async function pendingNames(client: Client): Promise<string[]> {
  const { data, error } = await client.rpc('pending_shared_concepts', {
    target_month: '2026-05-01',
  });

  if (error) throw error;

  return data.map((row) => row.name).sort();
}

// B sees A's shared Agua and Luz, not A's private concepts; A doesn't see their own; someone
// outside the household sees nothing.
const stranger = await signUp('Dani');

assert.deepEqual(await pendingNames(b.client), ['Agua', 'Luz']);

assert.deepEqual(await pendingNames(a.client), []);

assert.deepEqual(await pendingNames(stranger.client), []);

const waterEntry = await a.client
  .from('fixed_entries')
  .insert({ concept_id: water.data.id, month: '2026-05-01', amount: 5000 });

if (waterEntry.error) throw waterEntry.error;

assert.deepEqual(await pendingNames(b.client), ['Luz']);

console.log('ok 8 pending shared concepts stay inside the household');
