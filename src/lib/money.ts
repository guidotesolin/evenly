// Formats from ARCHITECTURE.md § Money: whole pesos; USD estimates with 2 decimals.
const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const usd = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' });

/** Shares are fractional in SQL; they are rounded here, for display only. */
export function formatArs(amount: number): string {
  return ars.format(Math.round(amount));
}

/**
 * Amounts are stored in pesos, so USD is always an estimate and carries `≈`. A month without a
 * reference rate has no USD estimate (not zero).
 */
export function formatUsd(amountArs: number, arsPerUsd: number | null): string | null {
  if (!arsPerUsd) return null;

  return `≈ ${usd.format(amountArs / arsPerUsd)}`;
}

const dollars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** An amount that is in dollars (an income paid in USD, whole dollars): exact, so no `≈`. */
export function formatDollars(amountUsd: number): string {
  return dollars.format(amountUsd);
}
