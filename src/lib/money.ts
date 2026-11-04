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

/** A month without a reference rate has no USD estimate (not zero). */
export function formatUsd(amountArs: number, arsPerUsd: number | null): string | null {
  if (!arsPerUsd) return null;

  return usd.format(amountArs / arsPerUsd);
}
