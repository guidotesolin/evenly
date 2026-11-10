// Pure helpers for the Compartidos screen; `npm run shared:smoke` checks them. No imports, so Node
// can run the smoke with plain type stripping.

/** The `date` column value for a day, in local time: `YYYY-MM-DD`. */
export function dayKey(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, '0');

  return `${day.getFullYear()}-${month}-${String(day.getDate()).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` as a local date (`new Date(key)` would read it as UTC midnight). */
export function parseDay(key: string): Date {
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number);

  return new Date(year, month - 1, day);
}

export function shiftDay(key: string, by: number): string {
  const day = parseDay(key);

  return dayKey(new Date(day.getFullYear(), day.getMonth(), day.getDate() + by));
}

/** `Hoy`, `Ayer`, else `lunes 2 de noviembre`. */
export function dayLabel(key: string, today: Date): string {
  if (key === dayKey(today)) return 'Hoy';

  if (key === shiftDay(dayKey(today), -1)) return 'Ayer';

  // ICU writes `lunes, 2 de noviembre`; the approved copy has no comma.
  return parseDay(key)
    .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '');
}

type Dated = { occurred_on: string };

/** Consecutive rows with the same day, in the order given (the screen sorts newest first). */
export function groupByDay<T extends Dated>(rows: T[]): { day: string; rows: T[] }[] {
  const groups: { day: string; rows: T[] }[] = [];

  for (const row of rows) {
    const last = groups.at(-1);

    if (last?.day === row.occurred_on) last.rows.push(row);
    else groups.push({ day: row.occurred_on, rows: [row] });
  }

  return groups;
}

type Movement = { kind: string; amount: number; paid_by: string };

/** Header totals: "Mis gastos" (expenses I paid) and "Gastos totales" (expenses only). */
export function monthTotals(movements: Movement[], me: string) {
  let mine = 0;
  let total = 0;

  for (const movement of movements) {
    if (movement.kind !== 'expense') continue;

    if (movement.paid_by === me) mine += movement.amount;
    total += movement.amount;
  }

  return { mine, total };
}

type Balance = { user_id: string; balance: number | null };

/**
 * Who I settle with and my balance in whole pesos (positive = they owe me). `null` without
 * another active member.
 */
// ponytail: the counterpart is the other active member whose balance is furthest the other way
// (with my balance at 0, the one owed most: nothing to settle anyway); exact for two members. A
// third member needs the explicit picker (ARCHITECTURE.md § Settling).
export function settleWith(balances: Balance[], me: string, active: string[]) {
  const mine = balances.find((row) => row.user_id === me)?.balance ?? 0;

  const others = balances
    .filter((row) => row.user_id !== me && active.includes(row.user_id))
    .sort((a, b) => (mine > 0 ? 1 : -1) * ((a.balance ?? 0) - (b.balance ?? 0)));

  const other = others[0];

  // `+ 0` turns -0 into 0, so a settled balance reads as "a mano".
  return other ? { other: other.user_id, balance: Math.round(mine) + 0 } : null;
}
