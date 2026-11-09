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

/** One of my concepts with this month's entry (`entryId` null = no entry yet). */
type OwnConcept = {
  id: string;
  name: string;
  emoji: string | null;
  isShared: boolean;
  entryId: string | null;
  amount: number | null;
};

/** A movement the shared-fixed trigger derived from someone's entry this month. */
type DerivedMovement = {
  fixed_entry_id: string | null;
  paid_by: string;
  description: string;
  amount: number;
  my_share: number | null;
};

/** Another member's shared concept with no amount yet this month (`pending_shared_concepts`). */
type PendingShared = { concept_id: string; name: string; owner_id: string };

export type FixedRow = {
  /** Concept id; for read-only rows, the other member's entry id. */
  id: string;
  name: string;
  emoji: string | null;
  isShared: boolean;
  /** Total; `null` = pending. */
  amount: number | null;
  /** My part when the amount is split; `null` when it is all mine. */
  share: number | null;
  /** Read-only rows: who pays. `null` for my own concepts. */
  paidBy: string | null;
};

/**
 * Fijos rows (ARCHITECTURE.md § Shared fixed costs). An entry of mine is split only if the
 * trigger derived a movement from it, so toggling `is_shared` never re-splits old amounts; the
 * share comes from the movement's `my_share`, never recomputed here. Shared costs paid by others
 * become read-only rows, pending while they have no amount yet. Sorted by name.
 */
export function monthRows(
  concepts: OwnConcept[],
  movements: DerivedMovement[],
  pending: PendingShared[],
  me: string,
): FixedRow[] {
  const shares = new Map<string, number>();
  const others: FixedRow[] = [];

  for (const movement of movements) {
    if (movement.fixed_entry_id === null) continue;

    if (movement.paid_by === me) shares.set(movement.fixed_entry_id, movement.my_share ?? 0);
    else {
      others.push({
        id: movement.fixed_entry_id,
        name: movement.description,
        emoji: null,
        isShared: true,
        amount: movement.amount,
        share: movement.my_share ?? 0,
        paidBy: movement.paid_by,
      });
    }
  }

  for (const concept of pending) {
    others.push({
      id: concept.concept_id,
      name: concept.name,
      emoji: null,
      isShared: true,
      amount: null,
      share: null,
      paidBy: concept.owner_id,
    });
  }

  const own = concepts.map(({ entryId, ...concept }) => ({
    ...concept,
    share: entryId === null ? null : (shares.get(entryId) ?? null),
    paidBy: null,
  }));

  return [...own, ...others].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** What a row adds to the month total: my share when split. `null` = pending. */
export const rowTotal = (row: FixedRow) => (row.amount === null ? null : (row.share ?? row.amount));

/** One of my entries, any month. */
type MonthEntry = { id: string; month: string; amount: number | null };

/** A derived movement with its date, for Evolución. */
type DatedMovement = {
  fixed_entry_id: string | null;
  paid_by: string;
  occurred_on: string;
  my_share: number | null;
};

/**
 * Evolución: each month's total, the same sum as the Fijos footer (my amounts, only my share of
 * the ones the trigger split, plus my share of shared costs others paid; pending adds nothing).
 * A derived movement always falls in its entry's month. Newest first.
 */
export function monthlyTotals(
  entries: MonthEntry[],
  movements: DatedMovement[],
  me: string,
): { month: string; total: number }[] {
  const shares = new Map<string, number>();
  const totals = new Map<string, number>();

  const add = (month: string, amount: number) =>
    totals.set(month, (totals.get(month) ?? 0) + amount);

  for (const movement of movements) {
    if (movement.fixed_entry_id === null) continue;

    if (movement.paid_by === me) shares.set(movement.fixed_entry_id, movement.my_share ?? 0);
    else add(`${movement.occurred_on.slice(0, 7)}-01`, movement.my_share ?? 0);
  }

  for (const entry of entries) {
    if (entry.amount !== null) add(entry.month, shares.get(entry.id) ?? entry.amount);
  }

  return [...totals]
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => b.month.localeCompare(a.month));
}
