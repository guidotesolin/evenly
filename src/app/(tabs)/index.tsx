import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Button, Input, Money, MonthSelector, Row, Screen, Sheet } from '@/components/ui';
import {
  groupThousands,
  monthKey,
  monthLabel,
  parseWholeNumber,
  summarizeMonth,
} from '@/lib/fixed';
import { formatArs, formatUsd } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { radius, space, type, useColors } from '@/theme';

// Fijos (ARCHITECTURE.md § Screens 3). `is_shared` is ignored until T6.

type Concept = { id: string; name: string; emoji: string | null; amount: number | null };

/** `key` is the month the data belongs to (`monthKey`). */
type MonthData = { key: string; concepts: Concept[]; rate: number | null };

async function fetchMonth(key: string): Promise<MonthData> {
  const [concepts, rate] = await Promise.all([
    supabase
      .from('fixed_concepts')
      .select('id, name, emoji, archived_at, fixed_entries(amount)')
      .eq('fixed_entries.month', key)
      .order('name'),
    supabase.from('reference_rates').select('ars_per_usd').eq('month', key).maybeSingle(),
  ]);

  if (concepts.error) throw concepts.error;

  if (rate.error) throw rate.error;

  return {
    key,
    // Active concepts, plus archived ones with an entry this month (even a pending one, so it
    // can still be filled in). A new month starts empty: entries are only read for this month.
    concepts: concepts.data.flatMap(({ fixed_entries, archived_at, ...concept }) =>
      archived_at === null || fixed_entries.length > 0
        ? [{ ...concept, amount: fixed_entries[0]?.amount ?? null }]
        : [],
    ),
    rate: rate.data?.ars_per_usd ?? null,
  };
}

export default function Fixed() {
  const c = useColors();

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
  const [concept, setConcept] = useState<Concept | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // Display only: amounts are always stored and typed in pesos.
  const [inUsd, setInUsd] = useState(false);
  // State updates land on the next render; the ref stops a double tap from writing twice.
  const writing = useRef(false);

  const load = useCallback(
    (key: string) =>
      fetchMonth(key)
        .then((next) => {
          if (next.key === shownKey.current) setData(next);
        })
        .catch((error: Error) => Alert.alert('Error', error.message)),
    [],
  );

  // On focus too, so concepts changed in Conceptos show up when coming back.
  useFocusEffect(
    useCallback(() => {
      load(monthKey(month));
    }, [load, month]),
  );

  async function save(write: PromiseLike<{ error: Error | null }>) {
    if (writing.current) return;

    writing.current = true;
    setBusy(true);
    const { error } = await write;

    writing.current = false;
    setBusy(false);

    if (error) {
      Alert.alert('Error', error.message);

      return;
    }

    setSheet(null);
    await load(monthKey(month));
  }

  const saveAmount = (target: Concept, amount: number | null) =>
    save(
      supabase
        .from('fixed_entries')
        .upsert(
          { concept_id: target.id, month: monthKey(month), amount },
          { onConflict: 'concept_id,month' },
        ),
    );

  const saveRate = (arsPerUsd: number) =>
    save(
      supabase
        .from('reference_rates')
        .upsert(
          { month: monthKey(month), ars_per_usd: arsPerUsd },
          { onConflict: 'owner_id,month' },
        ),
    );

  // Until the new month arrives, the previous one stays on screen, dimmed and read-only.
  const stale = data?.key !== monthKey(month);
  const parsed = parseWholeNumber(text);
  const summary = summarizeMonth(data?.concepts.map((row) => row.amount) ?? []);
  const rate = data?.rate ?? null;
  const usd = formatUsd(summary.total, rate);
  // A month without a rate falls back to pesos.
  const usdRate = inUsd ? rate : null;

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
              await load(monthKey(month));
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
              {data.concepts.map((row) => (
                <Row
                  key={row.id}
                  icon={row.emoji ?? row.name.charAt(0).toUpperCase()}
                  title={row.name}
                  onPress={
                    stale
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
        subtitle={monthLabel(month)}
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
