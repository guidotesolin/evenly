// CSV parsing and month mapping for the spreadsheet import: `npm run import:smoke`.
// Made-up fixture: real spreadsheet data never enters the repo.
import assert from 'node:assert/strict';
import { importPlan, monthColumns, parseCsv, parseSheet } from './excel-import.ts';

const months = [
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
];

// No year in the header: August 2025 onwards, the second "agosto" is 2026.
const mapped = monthColumns(['', ...months.map((month) => month.toUpperCase()), 'Promedio']);

assert.equal(mapped.length, 13);

assert.equal(mapped[0], '2025-08-01');

assert.equal(mapped[5], '2026-01-01');

assert.equal(mapped[12], '2026-08-01');

assert.equal(monthColumns(['', 'agosto', 'setiembre'])[1], '2025-09-01');

// A moved column fails instead of shifting every amount a month.
assert.throws(() => monthColumns(['', 'agosto', 'octubre']), /expected "septiembre"/);

assert.deepEqual(parseCsv('a,"$1,000.50","say ""hi"""\r\nb,,-'), [
  ['a', '$1,000.50', 'say "hi"'],
  ['b', '', '-'],
]);

const pesos = parseSheet(
  [
    'Gastos mensuales,,,',
    'Concepto,agosto,septiembre,octubre',
    'Alquiler,"$1,757,740.11","$1,800,000.00",-',
    'Auto,"$90,000.50",,"$ -"',
    ',,,',
    'Total,"$1,847,740.61","$1,800,000.00",$0.00',
  ].join('\n'),
);

const dollars = parseSheet(
  [
    'Concepto,agosto,septiembre,octubre',
    'Alquiler,"US$1,350.57","US$1,342.28",-',
    'Valor dolar,"$1,301.50","$1,341.00",-',
    'Celular,$18.22,#VALUE!,',
  ].join('\n'),
  'valor dolar',
);

// Imported during October: September's empty cell wasn't paid (0, shown as `-`); October's empty
// cells stay out, pending in the app.
const plan = importPlan(pesos, dollars, '2025-10-01');

// Cents rounded; `-`, empty and `$ -` all read as empty; Total and the blank row are skipped.
assert.deepEqual(plan.concepts, [
  {
    name: 'Alquiler',
    entries: [
      { month: '2025-08-01', amount: 1757740 },
      { month: '2025-09-01', amount: 1800000 },
    ],
  },
  {
    name: 'Auto',
    entries: [
      { month: '2025-08-01', amount: 90001 },
      { month: '2025-09-01', amount: 0 },
    ],
  },
]);

// Valor dolar becomes the rates (not rounded) and is not a concept.
assert.deepEqual(plan.rates, [
  { month: '2025-08-01', value: 1301.5 },
  { month: '2025-09-01', value: 1341 },
]);

assert.throws(() => parseSheet('x,agosto\nLuz,abc'), /Luz, 2025-08-01: "abc" is not an amount/);

assert.throws(() => importPlan(pesos, [], '2025-10-01'), /Valor dolar/);

console.log('ok import');
