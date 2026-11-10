// Pure helpers for Ingresos (ARCHITECTURE.md § Income); `npm run income:smoke` checks them. No
// imports, so Node can run the smoke with plain type stripping. Storage lives in the screen.

export type Currency = 'ARS' | 'USD';

/** One income, stored only on this phone. `amount` is whole units of `currency`. */
export type Income = {
  id: string;
  /** `YYYY-MM-01`, like `monthKey`. */
  month: string;
  concept: string;
  amount: number;
  currency: Currency;
};

/**
 * The month's total in pesos: pesos plus dollars at the month's reference rate. Without a rate the
 * dollars can't be added, so they come back apart (`unconverted`) instead of counting as zero.
 */
export function incomeTotals(incomes: Income[], rate: number | null) {
  let ars = 0;
  let unconverted = 0;

  for (const income of incomes) {
    if (income.currency === 'ARS') ars += income.amount;
    else if (rate) ars += income.amount * rate;
    else unconverted += income.amount;
  }

  return { ars, unconverted };
}

/**
 * Whether a stored value is a well-formed income. The screen refuses the whole stored list when one
 * isn't, rather than dropping it: the next save would erase it for good.
 */
export function isIncome(value: unknown): value is Income {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'month' in value &&
    typeof value.month === 'string' &&
    /^\d{4}-\d{2}-01$/.test(value.month) &&
    'concept' in value &&
    typeof value.concept === 'string' &&
    'amount' in value &&
    typeof value.amount === 'number' &&
    Number.isSafeInteger(value.amount) &&
    value.amount > 0 &&
    'currency' in value &&
    (value.currency === 'ARS' || value.currency === 'USD')
  );
}

export function newIncomeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

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

const HEADER = ['Mes', 'Total ARS', 'Total USD', 'Concepto', 'USD', 'Precio USD'];

/** `junio 2025` → `2025-06-01`; `null` if it isn't a month. */
function parseMonth(cell: string): string | null {
  const text = cell.trim().toLowerCase().replace('setiembre', 'septiembre');
  const match = /^([a-z]+)\s+(\d{4})$/.exec(text);
  const index = MONTHS.indexOf(match?.[1] ?? '');

  return match && index >= 0 ? `${match[2]}-${String(index + 1).padStart(2, '0')}-01` : null;
}

/**
 * A cell as Google Sheets copies it (US separators, like T7's import): `$230,000.00`, `2200`.
 * Empty is `null`; rounded to whole units. `undefined` = not a number.
 */
function parseAmount(cell: string): number | null | undefined {
  const text = cell.trim();

  // Empty, `-` or the accounting zero `$ -`, as in T7's import.
  if (/^(US)?\$?\s*-?$/.test(text)) return null;

  if (!/^(US)?\$?\s*(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(text)) return undefined;

  return Math.round(Number(text.replace(/[^\d.]/g, '')));
}

/**
 * A file picked in Importar: the "Ingresos" spreadsheet downloaded as `.tsv`, or what Exportar
 * wrote. Tab-separated rows of
 * `Mes`, `Total ARS`, `Total USD`, `Concepto`, `USD`, `Precio USD`. An empty `Mes` is the previous
 * row's month (merged cells copy their value only once). A row with `USD` is a dollar income; one
 * without it is the `Total ARS` in pesos, which is only that row's amount when the month has no
 * other row (in a merged month it is the whole month's total, so such a row fails rather than
 * importing the total). `Precio USD` is ignored: dollars are converted with the month's reference
 * rate. Throws, in Spanish (it is shown as is), naming the first bad line.
 */
// ponytail: tab-separated only (Sheets' `.tsv` download and Exportar's file); a CSV is refused
// with a message saying so. Add a CSV reader if the sheet ever has to come in as `.csv`.
export function parseIncomeSheet(text: string): Income[] {
  const incomes: Income[] = [];
  let month: string | null = null;

  // A BOM (some editors add one) would hide the header's `Mes`.
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line, index) => ({ number: index + 1, cells: line.split('\t') }))
    .filter(({ cells }) => cells.join('').trim() !== '');

  if (lines.length > 0 && lines.every(({ cells }) => cells.length === 1)) {
    throw new Error(
      'El archivo no tiene columnas separadas por tabulaciones: usá uno exportado desde Evenly o la planilla descargada como .tsv.',
    );
  }

  for (const [position, { number, cells }] of lines.entries()) {
    const fail = (why: string) => new Error(`Línea ${number}: ${why}`);
    const [monthCell = '', totalArs = '', , conceptCell = '', usdCell = ''] = cells;

    // Another row of the same merged month follows, or this one continues the previous one.
    const merged =
      monthCell.trim() === '' || (lines[position + 1]?.cells[0] ?? 'end').trim() === '';

    if (monthCell.trim() === HEADER[0]) continue;

    if (monthCell.trim() !== '') {
      month = parseMonth(monthCell);

      if (!month) throw fail(`"${monthCell.trim()}" no es un mes (ej.: junio 2025).`);
    }

    if (!month) throw fail('falta el mes.');

    const concept = conceptCell.trim();

    if (!concept) throw fail('falta el concepto.');

    const usd = parseAmount(usdCell);
    const ars = parseAmount(totalArs);

    if (usd === undefined) throw fail(`"${usdCell.trim()}" no es un monto en dólares.`);

    if (usd === null && ars === undefined) throw fail(`"${totalArs.trim()}" no es un monto.`);

    if (usd === null && merged) {
      throw fail('una fila sin USD en un mes con varias filas no tiene su monto: cargala a mano.');
    }

    const amount = usd ?? ars;

    if (!amount) throw fail('no tiene monto.');

    incomes.push({
      id: newIncomeId(),
      month,
      concept,
      amount,
      currency: usd === null ? 'ARS' : 'USD',
    });
  }

  return incomes;
}

/** The inverse of `parseIncomeSheet`, oldest month first: what Exportar shares. */
export function formatIncomeSheet(incomes: Income[]): string {
  const rows = [...incomes]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(({ month, concept, amount, currency }) => {
      const [year, monthNumber] = month.split('-');
      const label = `${MONTHS[Number(monthNumber) - 1]} ${year}`;
      const ars = currency === 'ARS' ? String(amount) : '';
      const usd = currency === 'USD' ? String(amount) : '';

      // A tab or line break inside a concept would shift the columns on the way back in.
      return [label, ars, '', concept.replace(/[\t\r\n]+/g, ' '), usd, ''].join('\t');
    });

  return [HEADER.join('\t'), ...rows].join('\n');
}
