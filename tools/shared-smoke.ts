// Day grouping, totals and settle counterpart for the Compartidos screen: `npm run shared:smoke`.
import assert from 'node:assert/strict';
import {
  dayKey,
  dayLabel,
  groupByDay,
  monthTotals,
  parseDay,
  settleWith,
  shiftDay,
} from '../src/lib/shared.ts';

assert.equal(dayKey(new Date(2026, 10, 5)), '2026-11-05');

// Local date, not UTC midnight (which is the day before in Argentina).
assert.equal(parseDay('2026-11-05').getDate(), 5);

assert.equal(shiftDay('2026-11-01', -1), '2026-10-31');

assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');

const today = new Date(2026, 10, 5, 23, 30);

assert.equal(dayLabel('2026-11-05', today), 'Hoy');

assert.equal(dayLabel('2026-11-04', today), 'Ayer');

assert.equal(dayLabel('2026-11-02', today), 'lunes 2 de noviembre');

assert.deepEqual(
  groupByDay([
    { occurred_on: '2026-11-05', id: 1 },
    { occurred_on: '2026-11-05', id: 2 },
    { occurred_on: '2026-11-02', id: 3 },
  ]).map((group) => [group.day, group.rows.map((row) => row.id)]),
  [
    ['2026-11-05', [1, 2]],
    ['2026-11-02', [3]],
  ],
);

// Reimbursements count in neither total; an expense I didn't share adds to the total only.
assert.deepEqual(
  monthTotals([
    { kind: 'expense', amount: 20000, my_share: 10000 },
    { kind: 'expense', amount: 900, my_share: 300 },
    { kind: 'expense', amount: 500, my_share: 0 },
    { kind: 'reimbursement', amount: 4000, my_share: 0 },
  ]),
  { mine: 10300, total: 21400 },
);

// A pays 20.000: B owes A 10.000; seen from B, the balance is negative.
const balances = [
  { user_id: 'a', balance: 10000 },
  { user_id: 'b', balance: -10000 },
];

assert.deepEqual(settleWith(balances, 'b', ['a', 'b']), { other: 'a', balance: -10000 });

assert.deepEqual(settleWith(balances, 'a', ['a', 'b']), { other: 'b', balance: 10000 });

// Fractional shares round for display; a settled balance is 0, not -0.
assert.deepEqual(
  settleWith(
    [
      { user_id: 'a', balance: -0.3 },
      { user_id: 'b', balance: 0.3 },
    ],
    'a',
    ['a', 'b'],
  ),
  {
    other: 'b',
    balance: 0,
  },
);

// At 0 the pick is still deterministic: the member owed most.
assert.equal(
  settleWith(
    [
      { user_id: 'a', balance: 0 },
      { user_id: 'b', balance: -500 },
      { user_id: 'c', balance: 500 },
    ],
    'a',
    ['a', 'b', 'c'],
  )?.other,
  'c',
);

// Alone in the household: nobody to settle with. Members who left are skipped.
assert.equal(settleWith([{ user_id: 'a', balance: 0 }], 'a', ['a']), null);

assert.equal(settleWith(balances, 'a', ['a']), null);

console.log('ok shared');
