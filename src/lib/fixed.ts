// Pure helpers for the Fijos screen; `npm run fixed:smoke` checks them. No imports, so Node can
// run the smoke with plain type stripping.

/** `null` = pending. Pending rows add nothing to the total. */
export function summarizeMonth(amounts: (number | null)[]) {
  let total = 0;
  let pending = 0;

  for (const amount of amounts) {
    if (amount === null) pending += 1;
    else total += amount;
  }

  return { total, pending };
}

/** Digits before any comma: pesos are whole, so cents are dropped, never rounded. */
function wholeDigits(text: string): string {
  return (text.split(',')[0] ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

/**
 * Whole pesos typed or pasted in `es-AR` style (`$ 1.757.740,51` → 1757740). Empty or
 * unsafe-sized input is `null`.
 */
export function parseWholeNumber(text: string): number | null {
  const digits = wholeDigits(text);
  const value = Number(digits);

  return digits && Number.isSafeInteger(value) ? value : null;
}

/**
 * Amount input as the user types, with `es-AR` thousands dots so 100.000 and 1.000.000 don't look
 * alike (`1000000` → `1.000.000`). A comma and anything after it are dropped: no cents.
 */
export function groupThousands(text: string): string {
  return wholeDigits(text).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** The `date` column value for a month: its first day, `YYYY-MM-01`. */
export function monthKey(month: Date): string {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
}

/** `Noviembre 2026`, as the month selector and the sheets show it. */
export function monthLabel(month: Date): string {
  const name = month.toLocaleDateString('es-AR', { month: 'long' });

  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.getFullYear()}`;
}
