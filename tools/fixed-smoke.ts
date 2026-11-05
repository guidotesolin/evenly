// Month total and USD estimate for the Fijos screen: `npm run fixed:smoke`.
import assert from 'node:assert/strict';
import {
  groupThousands,
  monthKey,
  monthLabel,
  parseWholeNumber,
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

console.log('ok fixed');
