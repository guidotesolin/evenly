import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Screen, SubScreenHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { monthKey, monthLabel, monthlyTotals } from '@/lib/fixed';
import { formatArs, formatUsd } from '@/lib/money';
import { parseDay } from '@/lib/shared';
import { useShowUsd } from '@/lib/show-usd';
import { supabase } from '@/lib/supabase';
import { radius, space, type, useColors } from '@/theme';

// Evolución (Fijos header): every month's total, newest first, with a bar to compare months and
// the USD estimate when the month has a reference rate.

type MonthTotal = { month: string; total: number; rate: number | null };

async function fetchTotals(me: string): Promise<MonthTotal[]> {
  // ponytail: whole history in one go, under PostgREST's 1,000-row default for years; page or
  // aggregate in SQL if it ever gets near.
  const [entries, movements, rates] = await Promise.all([
    supabase.from('fixed_entries').select('id, month, amount'),
    supabase
      .from('shared_movements')
      .select('fixed_entry_id, paid_by, occurred_on, my_share')
      .not('fixed_entry_id', 'is', null),
    supabase.from('reference_rates').select('month, ars_per_usd'),
  ]);

  if (entries.error) throw entries.error;

  if (movements.error) throw movements.error;

  if (rates.error) throw rates.error;

  const rateOf = new Map(rates.data.map((rate) => [rate.month, rate.ars_per_usd]));

  return monthlyTotals(entries.data, movements.data, me).map((row) => ({
    ...row,
    rate: rateOf.get(row.month) ?? null,
  }));
}

export default function History() {
  const c = useColors();
  const { session } = useAuth();
  const showUsd = useShowUsd();
  const [months, setMonths] = useState<MonthTotal[] | null>(null);
  const me = session?.user.id;

  useEffect(() => {
    if (!me) return;

    fetchTotals(me)
      .then(setMonths)
      .catch((error: Error) => Alert.alert('Error', error.message));
  }, [me]);

  const current = monthKey(new Date());
  const max = Math.max(1, ...(months ?? []).map((row) => row.total));

  return (
    <Screen edges={['bottom']} style={{ padding: 0, gap: 0 }}>
      <SubScreenHeader title="Evolución" />
      {months && (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
          {months.length === 0 ? (
            <Text style={[type.body, { color: c.muted }]}>Todavía no hay montos cargados.</Text>
          ) : (
            <View style={{ borderRadius: radius.field, overflow: 'hidden' }}>
              {months.map((row) => {
                const usd = showUsd ? formatUsd(row.total, row.rate) : null;
                // The current month still has pending amounts: say so and grey its bar, so it
                // doesn't read as a drop.
                const inProgress = row.month >= current;
                const label = monthLabel(parseDay(row.month));

                return (
                  <View
                    key={row.month}
                    accessible
                    accessibilityLabel={`${label}${inProgress ? ', en curso' : ''}: ${formatArs(row.total)}`}
                    style={{
                      gap: space.xs,
                      paddingVertical: space.md,
                      paddingHorizontal: space.lg,
                      backgroundColor: c.surface,
                      borderBottomWidth: 1,
                      borderBottomColor: c.line,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
                      <Text style={[type.body, { flex: 1, color: c.text }]}>
                        {label}
                        {inProgress && (
                          <Text style={[type.caption, { color: c.warn }]}> · En curso</Text>
                        )}
                      </Text>
                      <Text
                        style={[
                          type.body,
                          { color: c.text, fontWeight: '500', fontVariant: ['tabular-nums'] },
                        ]}
                      >
                        {formatArs(row.total)}
                      </Text>
                    </View>
                    <View
                      style={{ height: 6, borderRadius: radius.pill, backgroundColor: c.surface2 }}
                    >
                      <View
                        style={{
                          width: `${(row.total / max) * 100}%`,
                          height: 6,
                          borderRadius: radius.pill,
                          backgroundColor: inProgress ? c.muted : c.accent,
                        }}
                      />
                    </View>
                    {usd && (
                      <Text style={[type.caption, { color: c.muted, textAlign: 'right' }]}>
                        {usd}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
