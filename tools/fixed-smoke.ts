// Month total and USD estimate for the Fijos screen: `npm run fixed:smoke`.
import assert from 'node:assert/strict';
import {
  groupThousands,
  monthKey,
  monthLabel,
  monthRows,
  monthlyTotals,
  parseWholeNumber,
  rowTotal,
  summarizeMonth,
} from '../src/lib/fixed.ts';
import { formatArs, formatUsd } from '../src/lib/money.ts';

// Intl separates the currency with a no-break space; compare with plain spaces.
const plain = (text: string | null) => text?.replaceAll('\u00a0', ' ') ?? null;

// Pending rows are counted, not added.
assert.deepEqual(summarizeMonth([450000, null, 180000, 865000, null]), {
  total: 1495000,
  pending: 2,
});

assert.deepEqual(summarizeMonth([]), { total: 0, pending: 0 });

assert.equal(plain(formatArs(1495000)), '$ 1.495.000');

// USD = ARS / rate, 2 decimals, always marked as an estimate.
assert.equal(plain(formatUsd(1495000, 1450)), '≈ US$ 1.031,03');

// No rate → no USD (not zero).
assert.equal(formatUsd(1495000, null), null);

assert.equal(parseWholeNumber('$ 64.000'), 64000);

assert.equal(parseWholeNumber(''), null);

assert.equal(parseWholeNumber('0'), 0);

// No cents: a pasted amount with cents keeps the whole pesos, not ×100 and not rounded up.
assert.equal(parseWholeNumber('$1.757.740,51'), 1757740);

assert.equal(parseWholeNumber('1450,5'), 1450);

assert.equal(parseWholeNumber(',50'), null);

assert.equal(parseWholeNumber('99999999999999999999'), null);

assert.equal(groupThousands('100000'), '100.000');

assert.equal(groupThousands('1000000'), '1.000.000');

// Typing one more digit after a formatted value regroups it.
assert.equal(groupThousands('100.0000'), '1.000.000');

assert.equal(groupThousands('$1.757.740,11'), '1.757.740');

// Typing a comma does nothing.
assert.equal(groupThousands('64000,'), '64.000');

assert.equal(groupThousands('007'), '7');

assert.equal(groupThousands(''), '');

assert.equal(parseWholeNumber(groupThousands('64000,5')), 64000);

assert.equal(monthKey(new Date(2026, 10, 15)), '2026-11-01');

assert.equal(monthKey(new Date(2027, 0, 1)), '2027-01-01');

assert.equal(monthLabel(new Date(2026, 10, 1)), 'Noviembre 2026');

// Shared fixed costs (T6). Guido: Luz shared with a derived movement, Auto all his, Gas marked
// shared after its amount was entered (no movement: stays whole), Seguro pending. Sabrina's
// Internet comes in read-only with Guido's half; her Agua, not entered yet, is pending for him too.
const rows = monthRows(
  [
    { id: 'c-luz', name: 'Luz', emoji: null, isShared: true, entryId: 'e-luz', amount: 26000 },
    { id: 'c-auto', name: 'Auto', emoji: '🚗', isShared: false, entryId: 'e-auto', amount: 90000 },
    { id: 'c-gas', name: 'Gas', emoji: null, isShared: true, entryId: 'e-gas', amount: 8000 },
    { id: 'c-seguro', name: 'Seguro', emoji: null, isShared: false, entryId: null, amount: null },
  ],
  [
    {
      fixed_entry_id: 'e-luz',
      paid_by: 'guido',
      description: 'Luz',
      amount: 26000,
      my_share: 13000,
    },
    {
      fixed_entry_id: 'e-net',
      paid_by: 'sabrina',
      description: 'Internet',
      amount: 30000,
      my_share: 15000,
    },
  ],
  [{ concept_id: 'c-agua', name: 'Agua', owner_id: 'sabrina' }],
  'guido',
);

assert.deepEqual(
  rows.map((row) => [row.name, row.share, row.paidBy]),
  [
    ['Agua', null, 'sabrina'],
    ['Auto', null, null],
    ['Gas', null, null],
    ['Internet', 15000, 'sabrina'],
    ['Luz', 13000, null],
    ['Seguro', null, null],
  ],
);

// The total adds only my share of split rows; pending still counts as pending.
assert.deepEqual(summarizeMonth(rows.map(rowTotal)), {
  total: 90000 + 8000 + 15000 + 13000,
  pending: 2,
});

// Evolución: October has my Auto, my half of Luz and my half of Sabrina's Internet; September
// only a pending entry (nothing); a 0 counts as paid nothing. Newest first.
assert.deepEqual(
  monthlyTotals(
    [
      { id: 'e-auto', month: '2026-10-01', amount: 90000 },
      { id: 'e-luz', month: '2026-10-01', amount: 26000 },
      { id: 'e-gym', month: '2026-10-01', amount: 0 },
      { id: 'e-seguro', month: '2026-09-01', amount: null },
      { id: 'e-auto-8', month: '2026-08-01', amount: 85000 },
    ],
    [
      { fixed_entry_id: 'e-luz', paid_by: 'guido', occurred_on: '2026-10-09', my_share: 13000 },
      { fixed_entry_id: 'e-net', paid_by: 'sabrina', occurred_on: '2026-10-31', my_share: 15000 },
      { fixed_entry_id: null, paid_by: 'sabrina', occurred_on: '2026-10-02', my_share: 500 },
    ],
    'guido',
  ),
  [
    { month: '2026-10-01', total: 90000 + 13000 + 15000 },
    { month: '2026-08-01', total: 85000 },
  ],
);

console.log('ok fixed');
