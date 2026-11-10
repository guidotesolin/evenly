// Sheet import/export and month totals for Ingresos: `npm run income:smoke`. Made-up amounts in
// the real sheet's shape (personal figures stay out of the public repo).
import assert from 'node:assert/strict';
import { formatIncomeSheet, incomeTotals, isIncome, parseIncomeSheet } from '../src/lib/income.ts';

// The sheet downloaded as .tsv: tabs, US separators, merged months only on their first row, a
// peso-only row with no USD.
const pasted = [
  'Mes\tTotal ARS\tTotal USD\tConcepto\tUSD\tPrecio USD',
  'junio 2025\t$1,000,000.00\t1000\tSueldo\t1000\t$1,000.00',
  'agosto 2026\t$1,650,000.00\t1100\tSueldo\t1000\t$1,500.00',
  '\t\t\tExtra\t100\t$1,500.00',
  'Setiembre 2026\t$230,000.40\t\tVenta\t\t',
].join('\n');

const parsed = parseIncomeSheet(pasted);
const strip = (list: typeof parsed) => list.map(({ id: _id, ...rest }) => rest);

assert.deepEqual(strip(parsed), [
  { month: '2025-06-01', concept: 'Sueldo', amount: 1000, currency: 'USD' },
  { month: '2026-08-01', concept: 'Sueldo', amount: 1000, currency: 'USD' },
  { month: '2026-08-01', concept: 'Extra', amount: 100, currency: 'USD' },
  // Rounded to whole pesos.
  { month: '2026-09-01', concept: 'Venta', amount: 230000, currency: 'ARS' },
]);

// Ids are unique, so editing one imported row never touches another.
assert.equal(new Set(parsed.map((income) => income.id)).size, parsed.length);

// Exportar → Importar gives back the same incomes.
assert.deepEqual(strip(parseIncomeSheet(formatIncomeSheet(parsed))), strip(parsed));

// Bad input fails naming the line instead of importing something wrong.
assert.throws(() => parseIncomeSheet('junio\t\t\tSueldo\t1000'), /Línea 1: "junio" no es un mes/);

assert.throws(() => parseIncomeSheet('\t\t\tSueldo\t1000'), /Línea 1: falta el mes/);

assert.throws(() => parseIncomeSheet('junio 2025\t\t\tSueldo\t1.000,50'), /Línea 1: "1.000,50"/);

assert.throws(() => parseIncomeSheet('junio 2025\t\t\tSueldo\t\t'), /Línea 1: no tiene monto/);

// The accounting zero `$ -` is an empty cell, not a bad one.
assert.throws(() => parseIncomeSheet('junio 2025\t$ -\t\tSueldo\t\t'), /Línea 1: no tiene monto/);

// In a merged month `Total ARS` is the month's total, not a peso row's amount: fail, either row.
const mergedPesoFirst = 'julio 2026\t$500,000.00\t\tVenta\t\t\n\t\t\tSueldo\t100\t';
const mergedPesoSecond = 'julio 2026\t$500,000.00\t100\tSueldo\t100\t\n\t\t\tVenta\t\t';

assert.throws(() => parseIncomeSheet(mergedPesoFirst), /Línea 1: una fila sin USD/);

assert.throws(() => parseIncomeSheet(mergedPesoSecond), /Línea 2: una fila sin USD/);

// Dollars at the month's rate; without a rate they stay apart instead of counting as zero.
const august = parsed.filter((income) => income.month === '2026-08-01');

assert.deepEqual(incomeTotals([...august, parsed[3]!], 1500), { ars: 1880000, unconverted: 0 });

assert.deepEqual(incomeTotals([...august, parsed[3]!], null), { ars: 230000, unconverted: 1100 });

assert.deepEqual(incomeTotals([], 1500), { ars: 0, unconverted: 0 });

// A BOM before the header doesn't hide it.
assert.equal(parseIncomeSheet(`\uFEFF${pasted}`).length, parsed.length);

// A CSV (Sheets' default download) is refused saying why, not as a bad month.
assert.throws(
  () =>
    parseIncomeSheet('Mes,Total ARS,Total USD,Concepto,USD,Precio USD\njunio 2025,,,Sueldo,1000,'),
  /no tiene columnas separadas por tabulaciones/,
);

// A tab typed inside a concept doesn't break the export.
const tabbed = { ...parsed[0]!, concept: 'Sueldo\tjunio' };

assert.deepEqual(strip(parseIncomeSheet(formatIncomeSheet([tabbed]))), [
  { month: '2025-06-01', concept: 'Sueldo junio', amount: 1000, currency: 'USD' },
]);

// Stored items are checked one by one before the screen trusts them.
assert.ok(parsed.every(isIncome));

assert.equal(isIncome({ ...parsed[0], concept: undefined }), false);

assert.equal(isIncome({ ...parsed[0], amount: 0 }), false);

assert.equal(isIncome({ ...parsed[0], month: 'junio' }), false);

assert.equal(isIncome(null), false);

console.log('income smoke: ok');
