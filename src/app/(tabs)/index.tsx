import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { Button, Input, Money, MonthSelector, Row, Screen, Sheet } from '@/components/ui';
import { fetchMembers, useAuth, type Member } from '@/lib/auth';
import {
  groupThousands,
  monthKey,
  monthLabel,
  monthRows,
  parseWholeNumber,
  rowTotal,
  summarizeMonth,
  type FixedRow,
} from '@/lib/fixed';
import { formatArs, formatUsd } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { radius, space, type, useColors } from '@/theme';

// Fijos (ARCHITECTURE.md § Screens 3 and § Shared fixed costs).

/** `key` is the month the data belongs to (`monthKey`). */
type MonthData = { key: string; rows: FixedRow[]; rate: number | null; members: Member[] };

async function fetchMonth(month: Date, householdId: string, me: string): Promise<MonthData> {
  const key = monthKey(month);

  const [concepts, movements, pending, rate, members] = await Promise.all([
    supabase
      .from('fixed_concepts')
      .select('id, name, emoji, is_shared, archived_at, fixed_entries(id, amount)')
      .eq('fixed_entries.month', key)
      .order('name'),
    // Shared fixed costs derived this month: mine give my share, the others' are read-only rows.
    // The trigger dates them inside the entry's month.
    supabase
      .from('shared_movements')
      .select('fixed_entry_id, paid_by, description, amount, my_share, concept_emoji')
      .eq('household_id', householdId)
      .not('fixed_entry_id', 'is', null)
      .gte('occurred_on', key)
      .lt('occurred_on', monthKey(new Date(month.getFullYear(), month.getMonth() + 1, 1))),
    // The others' shared costs not entered yet: pending for me too.
    supabase.rpc('pending_shared_concepts', { target_month: key }),
    supabase.from('reference_rates').select('ars_per_usd').eq('month', key).maybeSingle(),
    fetchMembers(householdId),
  ]);

  if (concepts.error) throw concepts.error;

  if (movements.error) throw movements.error;

  if (pending.error) throw pending.error;

  if (rate.error) throw rate.error;

  // Active concepts, plus archived ones with an entry this month (even a pending one, so it can
  // still be filled in). A new month starts empty: entries are only read for this month.
  const own = concepts.data.flatMap(({ fixed_entries, archived_at, is_shared, ...concept }) =>
    archived_at === null || fixed_entries.length > 0
      ? [
          {
            ...concept,
            isShared: is_shared,
            entryId: fixed_entries[0]?.id ?? null,
            amount: fixed_entries[0]?.amount ?? null,
          },
        ]
      : [],
  );

  return {
    key,
    rows: monthRows(own, movements.data, pending.data, me),
    rate: rate.data?.ars_per_usd ?? null,
    members,
  };
}

export default function Fixed() {
  const c = useColors();
  const { session, householdId } = useAuth();
  // The tabs only mount with a session and a household (root layout guards).
  const me = session?.user.id ?? '';
  const household = householdId ?? '';

  const [month, setMonth] = useState(() => {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // The month on screen, for responses that arrive after the user moved to another one.
  const shownKey = useRef(monthKey(month));
  const [data, setData] = useState<MonthData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<'amount' | 'rate' | null>(null);
  // Kept after the sheet closes so its title doesn't blank out during the fade.
  const [concept, setConcept] = useState<FixedRow | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // Display only: amounts are always stored and typed in pesos.
  const [inUsd, setInUsd] = useState(false);
  // State updates land on the next render; the ref stops a double tap from writing twice.
  const writing = useRef(false);

  const load = useCallback(
    (shown: Date) =>
      fetchMonth(shown, household, me)
        .then((next) => {
          if (next.key === shownKey.current) setData(next);
        })
        .catch((error: Error) => Alert.alert('Error', error.message)),
    [household, me],
  );

  // On focus too, so concepts changed in Conceptos show up when coming back.
  useFocusEffect(
    useCallback(() => {
      load(month);
    }, [load, month]),
  );

  /** Runs a write, then reloads the month; `true` if it worked. */
  async function save(write: PromiseLike<{ error: Error | null }>): Promise<boolean> {
    if (writing.current) return false;

    writing.current = true;
    setBusy(true);
    const { error } = await write;

    writing.current = false;
    setBusy(false);

    if (error) {
      Alert.alert('Error', error.message);

      return false;
    }

    await load(month);

    return true;
  }

  const close = (saved: boolean) => saved && setSheet(null);

  const saveAmount = (target: FixedRow, amount: number | null) =>
    save(
      supabase
        .from('fixed_entries')
        .upsert(
          { concept_id: target.id, month: monthKey(month), amount },
          { onConflict: 'concept_id,month' },
        ),
    ).then(close);

  /** The amount sheet's switch: same as in Conceptos, it applies to amounts saved from now on. */
  async function toggleShared(target: FixedRow, isShared: boolean) {
    setConcept({ ...target, isShared });

    const saved = await save(
      supabase.from('fixed_concepts').update({ is_shared: isShared }).eq('id', target.id),
    );

    if (!saved) setConcept(target);
  }

  const saveRate = (arsPerUsd: number) =>
    save(
      supabase
        .from('reference_rates')
        .upsert(
          { month: monthKey(month), ars_per_usd: arsPerUsd },
          { onConflict: 'owner_id,month' },
        ),
    ).then(close);

  // Until the new month arrives, the previous one stays on screen, dimmed and read-only.
  const stale = data?.key !== monthKey(month);
  const parsed = parseWholeNumber(text);
  const summary = summarizeMonth(data?.rows.map(rowTotal) ?? []);
  const rate = data?.rate ?? null;
  const usd = formatUsd(summary.total, rate);
  // A month without a rate falls back to pesos.
  const usdRate = inUsd ? rate : null;
  const nameOf = (id: string) => data?.members.find((member) => member.id === id)?.name ?? '';
  // ponytail: the hint splits by today's active members; the saved row shows the movement's real
  // share (participant_count on its date). Differs only in a month when someone joined or left.
  const sharers = data?.members.filter((member) => member.active).length ?? 0;

  function detailOf(row: FixedRow): string | undefined {
    // No total for pending or for 0 (not paid): the row already shows `Pendiente` or `-`.
    const total =
      row.amount === null || row.amount === 0 ? '' : ` · total ${formatArs(row.amount)}`;

    if (row.paidBy !== null) {
      const name = nameOf(row.paidBy);

      return row.amount === null ? `Paga ${name}` : `Pagó ${name}${total}`;
    }

    return row.share === null ? undefined : `Compartido${total}`;
  }

  return (
    <Screen edges={[]} style={{ padding: 0, gap: 0 }}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
        // Pull to refresh is also the retry after a failed load.
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[c.accent]}
            progressBackgroundColor={c.surface}
            onRefresh={async () => {
              setRefreshing(true);
              await load(month);
              setRefreshing(false);
            }}
          />
        }
      >
        <MonthSelector
          month={month}
          onChange={(next) => {
            shownKey.current = monthKey(next);
            setMonth(next);
          }}
        />

        {data && (
          <View style={{ gap: space.md, opacity: stale ? 0.5 : 1 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: radius.field,
                backgroundColor: c.accentSoft,
                overflow: 'hidden',
              }}
            >
              <Pressable
                accessibilityRole="button"
                disabled={stale}
                android_ripple={{ color: c.line }}
                onPress={() => {
                  // Whole pesos per dollar, like every peso amount (older rates may carry decimals).
                  setText(rate === null ? '' : groupThousands(String(Math.round(rate))));
                  setSheet('rate');
                }}
                style={{
                  flex: 1,
                  minHeight: 56,
                  justifyContent: 'center',
                  gap: 2,
                  paddingVertical: space.sm,
                  paddingHorizontal: space.lg,
                }}
              >
                {rate === null ? (
                  <Text style={[type.label, { color: c.accent }]}>Dólar de referencia</Text>
                ) : (
                  <>
                    <Text style={[type.caption, { color: c.muted }]}>Dólar de referencia</Text>
                    <Money amount={rate} style={{ fontWeight: '500' }} />
                  </>
                )}
              </Pressable>
              {rate !== null && <CurrencySwitch usd={inUsd} disabled={stale} onChange={setInUsd} />}
            </View>

            <View style={{ borderRadius: radius.field, overflow: 'hidden' }}>
              {data.rows.map((row) => (
                <Row
                  key={row.id}
                  icon={row.emoji ?? row.name.charAt(0).toUpperCase()}
                  title={row.name}
                  detail={detailOf(row)}
                  // Read-only: someone else's shared cost, edited from their phone.
                  onPress={
                    stale || row.paidBy !== null
                      ? undefined
                      : () => {
                          setText(row.amount === null ? '' : groupThousands(String(row.amount)));
                          setConcept(row);
                          setSheet('amount');
                        }
                  }
                  right={
                    row.amount === null ? (
                      <PendingChip label="Pendiente" />
                    ) : row.amount === 0 ? (
                      // 0 = not paid this month (skipped the gym): settled, not pending.
                      <Text
                        accessibilityLabel="No se pagó"
                        style={[type.body, { color: c.muted, fontWeight: '500' }]}
                      >
                        -
                      </Text>
                    ) : row.share !== null ? (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Money amount={row.share} usdRate={usdRate} style={{ fontWeight: '500' }} />
                        <Text style={[type.caption, { color: c.muted, fontWeight: '400' }]}>
                          tu parte
                        </Text>
                      </View>
                    ) : (
                      <Money amount={row.amount} usdRate={usdRate} style={{ fontWeight: '500' }} />
                    )
                  }
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {data && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: space.md,
            paddingVertical: space.md,
            paddingHorizontal: space.lg,
            borderTopWidth: 1,
            borderTopColor: c.line,
            backgroundColor: c.surface,
            opacity: stale ? 0.5 : 1,
          }}
        >
          <View style={{ flex: 1, gap: space.xs, alignItems: 'flex-start' }}>
            <Text style={[type.caption, { color: c.muted }]}>Total del mes</Text>
            {summary.pending > 0 && (
              <PendingChip
                label={`${summary.pending} ${summary.pending === 1 ? 'pendiente' : 'pendientes'}`}
              />
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Money amount={summary.total} usdRate={usdRate} style={type.total} />
            {usd && (
              <Text style={[type.label, { color: c.muted, fontWeight: '400' }]}>
                {usdRate ? formatArs(summary.total) : usd}
              </Text>
            )}
          </View>
        </View>
      )}

      <Sheet
        visible={sheet === 'amount'}
        onClose={() => setSheet(null)}
        title={concept ? `${concept.emoji ?? ''} ${concept.name}`.trim() : ''}
        subtitle={concept?.isShared ? `${monthLabel(month)} · Compartido` : monthLabel(month)}
      >
        <Input
          label="Monto"
          value={text}
          // ponytail: reformatting moves the cursor when editing mid-number; track the selection
          // if that turns out to matter (amounts are typed at the end).
          onChangeText={(next) => setText(groupThousands(next))}
          keyboardType="number-pad"
          autoFocus
          style={[type.title, { fontVariant: ['tabular-nums'] }]}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={[type.body, { flex: 1, color: c.text }]}>Compartido</Text>
          <Switch
            accessibilityLabel="Compartido"
            value={concept?.isShared ?? false}
            disabled={busy}
            trackColor={{ true: c.accent, false: c.line }}
            thumbColor={c.surface}
            onValueChange={(isShared) => {
              if (concept) toggleShared(concept, isShared);
            }}
          />
        </View>
        {concept?.isShared && parsed && sharers > 0 ? (
          <Text style={[type.label, { color: c.muted, fontWeight: '400' }]}>
            Al ser compartido, se suma a Compartidos como gasto pagado por vos. Tu parte:{' '}
            {formatArs(parsed / sharers)}.
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Dejar pendiente"
              variant="text"
              disabled={busy}
              onPress={() => concept && saveAmount(concept, null)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Guardar"
              disabled={busy || parsed === null}
              onPress={() => concept && saveAmount(concept, parsed)}
            />
          </View>
        </View>
      </Sheet>

      <Sheet
        visible={sheet === 'rate'}
        onClose={() => setSheet(null)}
        title="Dólar de referencia"
        subtitle={monthLabel(month)}
      >
        <Input
          label="Pesos por dólar"
          value={text}
          onChangeText={(next) => setText(groupThousands(next))}
          keyboardType="number-pad"
          autoFocus
          style={[type.title, { fontVariant: ['tabular-nums'] }]}
        />
        <Button
          title="Guardar"
          disabled={busy || !parsed}
          onPress={() => parsed && saveRate(parsed)}
        />
      </Sheet>
    </Screen>
  );
}

/** `ARS | USD` in the rate card. */
function CurrencySwitch({
  usd,
  disabled,
  onChange,
}: {
  usd: boolean;
  disabled: boolean;
  onChange: (usd: boolean) => void;
}) {
  const c = useColors();

  return (
    <View style={{ flexDirection: 'row', marginRight: space.md, gap: 2 }}>
      {[
        { value: false, glyph: 'ARS', label: 'Ver en pesos' },
        { value: true, glyph: 'USD', label: 'Ver en dólares' },
      ].map((option) => {
        const selected = option.value === usd;

        return (
          <Pressable
            key={option.glyph}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={{
              minWidth: 48,
              minHeight: 40,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space.sm,
              borderRadius: radius.pill,
              backgroundColor: selected ? c.accent : 'transparent',
            }}
          >
            <Text style={[type.label, { color: selected ? c.onAccent : c.accent }]}>
              {option.glyph}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PendingChip({ label }: { label: string }) {
  const c = useColors();

  return (
    <Text
      style={[
        type.caption,
        {
          paddingVertical: 2,
          paddingHorizontal: 10,
          borderRadius: radius.pill,
          overflow: 'hidden',
          backgroundColor: c.warnSoft,
          color: c.warn,
        },
      ]}
    >
      {label}
    </Text>
  );
}
