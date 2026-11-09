import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  Button,
  Card,
  DaySelector,
  Input,
  Money,
  MonthSelector,
  Row,
  Screen,
  Sheet,
} from '@/components/ui';
import { fetchMembers, useAuth, type Member } from '@/lib/auth';
import { groupThousands, monthKey, parseWholeNumber } from '@/lib/fixed';
import { formatArs } from '@/lib/money';
import { dayKey, dayLabel, groupByDay, monthTotals, settleWith } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import { radius, space, type, useColors } from '@/theme';

// Compartidos (ARCHITECTURE.md § Screens 4, § Balances, § Settling).

type Movement = {
  id: string;
  kind: string;
  paid_by: string;
  description: string;
  amount: number;
  occurred_on: string;
  fixed_entry_id: string | null;
  my_share: number | null;
};

/** `key` is the month the movements belong to (`monthKey`); the balance is all-time. */
type ScreenData = {
  key: string;
  movements: Movement[];
  members: Member[];
  settle: ReturnType<typeof settleWith>;
};

async function fetchScreen(householdId: string, me: string, month: Date): Promise<ScreenData> {
  const key = monthKey(month);

  const [movements, balances, members] = await Promise.all([
    supabase
      .from('shared_movements')
      .select('id, kind, paid_by, description, amount, occurred_on, fixed_entry_id, my_share')
      .eq('household_id', householdId)
      .gte('occurred_on', key)
      .lt('occurred_on', monthKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)))
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('household_balances').select('user_id, balance').eq('household_id', householdId),
    fetchMembers(householdId),
  ]);

  if (movements.error) throw movements.error;

  if (balances.error) throw balances.error;

  const active = members.filter((member) => member.active).map((member) => member.id);

  return {
    key,
    movements: movements.data,
    members,
    settle: settleWith(balances.data, me, active),
  };
}

export default function Shared() {
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
  const [data, setData] = useState<ScreenData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [text, setText] = useState('');
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [busy, setBusy] = useState(false);
  // State updates land on the next render; the ref stops a double tap from writing twice.
  const writing = useRef(false);

  const load = useCallback(
    (target: Date) =>
      fetchScreen(household, me, target)
        .then((next) => {
          if (next.key === shownKey.current) setData(next);
        })
        .catch((error: Error) => Alert.alert('Error', error.message)),
    [household, me],
  );

  // On focus too, so a movement saved in the form shows up when coming back.
  useFocusEffect(
    useCallback(() => {
      load(month);
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

    setSettling(false);
    await load(month);
  }

  const nameOf = (id: string) => data?.members.find((member) => member.id === id)?.name ?? '';

  function detailOf(movement: Movement): string {
    const mine = movement.paid_by === me;

    if (movement.kind === 'reimbursement') {
      return mine ? 'Transferiste vos' : `Te transfirió ${nameOf(movement.paid_by)}`;
    }

    return mine ? 'Pagaste vos' : `Pagó ${nameOf(movement.paid_by)}`;
  }

  function open(movement: Movement) {
    if (movement.kind === 'expense') {
      router.push({ pathname: '/expense', params: { id: movement.id } });

      return;
    }

    Alert.alert('¿Eliminar este reembolso?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => save(supabase.from('shared_movements').delete().eq('id', movement.id)),
      },
    ]);
  }

  // Until the new month arrives, the previous one stays on screen, dimmed and read-only.
  const stale = data?.key !== monthKey(month);
  const totals = monthTotals(data?.movements ?? []);
  const settle = data?.settle ?? null;
  const parsed = parseWholeNumber(text);
  const other = settle ? nameOf(settle.other) : '';
  const theyOwe = (settle?.balance ?? 0) > 0;

  return (
    <Screen edges={[]} style={{ padding: 0, gap: 0 }}>
      <ScrollView
        // Room for the floating button over the last row.
        contentContainerStyle={{ padding: space.lg, paddingBottom: 96, gap: space.md }}
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
            <View style={{ flexDirection: 'row', gap: space.md }}>
              {[
                { label: 'Mis gastos', amount: totals.mine },
                { label: 'Gastos totales', amount: totals.total },
              ].map((total) => (
                <Card key={total.label} style={{ flex: 1, gap: 2, paddingVertical: space.md }}>
                  <Text style={[type.caption, { color: c.muted }]}>{total.label}</Text>
                  <Money
                    amount={total.amount}
                    style={{ fontSize: 20, lineHeight: 26, fontWeight: '700' }}
                  />
                </Card>
              ))}
            </View>

            {settle && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  padding: space.md,
                  paddingLeft: space.lg,
                  borderRadius: radius.field,
                  backgroundColor: c.accentSoft,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  {settle.balance === 0 && (
                    <Text style={[type.title, { color: c.text }]}>Están a mano</Text>
                  )}
                  {theyOwe && (
                    <>
                      <Text style={[type.label, { color: c.text }]}>{other} te debe</Text>
                      <Money amount={settle.balance} style={[type.total, { color: c.accent }]} />
                    </>
                  )}
                  {settle.balance < 0 && (
                    <Text style={[type.title, { color: c.warn }]}>
                      Le debés {formatArs(-settle.balance)} a {other}
                    </Text>
                  )}
                </View>
                {settle.balance !== 0 && (
                  <Button
                    title="Saldar"
                    disabled={stale}
                    onPress={() => {
                      setText(groupThousands(String(Math.abs(settle.balance))));
                      setDay(dayKey(new Date()));
                      setSettling(true);
                    }}
                  />
                )}
              </View>
            )}

            {groupByDay(data.movements).map((group) => (
              <View key={group.day} style={{ gap: 6 }}>
                <Text
                  accessibilityRole="header"
                  style={[type.caption, { color: c.muted, paddingHorizontal: space.xs }]}
                >
                  {dayLabel(group.day, new Date())}
                </Text>
                <View style={{ borderRadius: radius.field, overflow: 'hidden' }}>
                  {group.rows.map((movement) => (
                    <Row
                      key={movement.id}
                      title={movement.description}
                      badge={movement.fixed_entry_id ? 'Fijo' : undefined}
                      detail={detailOf(movement)}
                      onPress={stale ? undefined : () => open(movement)}
                      right={
                        <Money
                          amount={movement.amount}
                          style={{
                            fontWeight: '500',
                            color: movement.kind === 'reimbursement' ? c.muted : c.text,
                          }}
                        />
                      }
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/expense')}
        android_ripple={{ color: c.onAccent }}
        style={{
          position: 'absolute',
          right: space.lg,
          bottom: space.lg,
          height: 56,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingLeft: space.lg,
          paddingRight: 20,
          borderRadius: radius.sheet,
          backgroundColor: c.accent,
          overflow: 'hidden',
          elevation: 4,
        }}
      >
        <Text
          importantForAccessibility="no"
          style={{ fontSize: 24, lineHeight: 28, color: c.onAccent }}
        >
          +
        </Text>
        <Text style={[type.label, { color: c.onAccent }]}>Agregar gasto</Text>
      </Pressable>

      <Sheet
        visible={settling}
        onClose={() => setSettling(false)}
        title="Saldar"
        subtitle={
          theyOwe
            ? `Registrá lo que ${other} te transfirió.`
            : `Registrá lo que le transferiste a ${other}.`
        }
      >
        <Input
          label="Monto"
          value={text}
          onChangeText={(next) => setText(groupThousands(next))}
          keyboardType="number-pad"
          autoFocus
          style={[type.title, { fontVariant: ['tabular-nums'] }]}
        />
        <Text style={[type.label, { color: c.muted, fontWeight: '400' }]}>
          Saldo pendiente: {formatArs(Math.abs(settle?.balance ?? 0))}. Podés saldar una parte y el
          resto queda pendiente.
        </Text>
        <DaySelector day={day} onChange={setDay} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Cancelar" variant="text" onPress={() => setSettling(false)} />
          </View>
          <View style={{ flex: 2 }}>
            <Button
              title="Registrar transferencia"
              disabled={busy || !parsed || !settle}
              onPress={() =>
                settle &&
                parsed &&
                save(
                  supabase.from('shared_movements').insert({
                    household_id: household,
                    kind: 'reimbursement',
                    description: 'Reembolso',
                    amount: parsed,
                    occurred_on: day,
                    // From whoever owes to whoever is owed.
                    paid_by: theyOwe ? settle.other : me,
                    paid_to: theyOwe ? me : settle.other,
                  }),
                )
              }
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}
