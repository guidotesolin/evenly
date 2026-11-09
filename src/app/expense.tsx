import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, DaySelector, IconButton, Input, Screen } from '@/components/ui';
import { cachedMembers, fetchMembers, useAuth, type Member } from '@/lib/auth';
import { groupThousands, parseWholeNumber } from '@/lib/fixed';
import { formatArs } from '@/lib/money';
import { dayKey } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import { radius, space, type, useColors } from '@/theme';

// Add / edit / delete an expense (ARCHITECTURE.md § Screens 4). With `id` it edits that one;
// a derived movement (`fixed_entry_id`) opens read-only, since it is edited from Fijos.

export default function Expense() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, householdId } = useAuth();
  // Only reachable from the tabs, which need a session and a household (root layout guards).
  const me = session?.user.id ?? '';
  const household = householdId ?? '';

  // The tab loaded them just before opening the form; fetched only if it didn't.
  const [members, setMembers] = useState<Member[]>(() => cachedMembers(household) ?? []);
  const [description, setDescription] = useState('');
  const [text, setText] = useState('');
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [paidBy, setPaidBy] = useState(me);
  const [derived, setDerived] = useState(false);
  // Editing: fields stay locked until the stored values arrive, so a late load can't overwrite
  // what was typed and "Eliminar gasto" can't run before we know the movement is derived.
  const [loaded, setLoaded] = useState(!id);
  // Members taking part on a day, for the split hint. Tagged with its day so an answer for a day
  // the user already stepped past is never shown.
  const [counted, setCounted] = useState<{ day: string; count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  // State updates land on the next render; the ref stops a double tap from writing twice.
  const writing = useRef(false);

  useEffect(() => {
    if (!cachedMembers(household)) {
      fetchMembers(household)
        .then(setMembers)
        .catch((error: Error) => Alert.alert('Error', error.message));
    }

    if (!id) return;

    supabase
      .from('shared_movements')
      .select('description, amount, occurred_on, paid_by, fixed_entry_id')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          Alert.alert('Error', error.message);

          return;
        }

        setDescription(data.description);
        setText(groupThousands(String(data.amount)));
        setDay(data.occurred_on);
        setPaidBy(data.paid_by);
        setDerived(data.fixed_entry_id !== null);
        setLoaded(true);
      });
  }, [household, id]);

  useEffect(() => {
    supabase
      .rpc('participant_count', { target_household: household, on_date: day })
      .then(({ data, error }) => {
        if (error) Alert.alert('Error', error.message);
        else setCounted({ day, count: data });
      });
  }, [household, day]);

  const participants = counted?.day === day ? counted.count : null;

  /** `.select('id')` on every write: RLS makes a write that matches no row succeed silently. */
  async function write(
    request: PromiseLike<{ data: { id: string }[] | null; error: Error | null }>,
  ) {
    if (writing.current) return;

    writing.current = true;
    setBusy(true);
    const { data, error } = await request;

    writing.current = false;
    setBusy(false);

    if (error) {
      Alert.alert('Error', error.message);

      return;
    }

    // Deleted from the other phone meanwhile (or derived, which clients can't touch).
    if (!data?.length) Alert.alert('Error', 'Este gasto ya no existe.');

    router.back();
  }

  const parsed = parseWholeNumber(text);

  // Paid by: me first ("Vos"), then the other active members. Only active members can pay (RLS),
  // so an old expense paid by someone who left needs a new payer before it can be saved.
  const payers = members
    .filter((member) => member.active)
    .sort((a, b) => Number(b.id === me) - Number(a.id === me));

  const valid =
    description.trim() !== '' &&
    !!parsed &&
    // Nobody to split with that day (before the household existed): the payer would be
    // credited with no one owing it.
    !!participants &&
    payers.some((member) => member.id === paidBy);

  const editable = loaded && !derived;

  function save() {
    if (!parsed) return;

    const fields = {
      description: description.trim(),
      amount: parsed,
      occurred_on: day,
      paid_by: paidBy,
    };

    write(
      id
        ? supabase.from('shared_movements').update(fields).eq('id', id).select('id')
        : supabase
            .from('shared_movements')
            .insert({ ...fields, household_id: household, kind: 'expense' })
            .select('id'),
    );
  }

  return (
    <Screen edges={['bottom']} style={{ padding: 0, gap: 0 }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: id ? 'Editar gasto' : 'Nuevo gasto',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: c.bg },
          headerTitleStyle: type.title,
          headerLeft: () => (
            <IconButton
              glyph="✕"
              label="Cerrar"
              onPress={() => router.back()}
              size={22}
              color={c.text}
            />
          ),
        }}
      />
      {/* Edge-to-edge Android doesn't resize for the keyboard; this keeps Guardar reachable. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, padding: space.lg, gap: space.lg }}
        >
          {derived && (
            <Text style={[type.label, { color: c.muted, fontWeight: '400' }]}>
              Viene de Fijos: se edita desde ahí.
            </Text>
          )}
          <Input
            label="Descripción"
            placeholder="Ej.: Supermercado"
            value={description}
            onChangeText={setDescription}
            editable={editable}
            autoFocus={!id}
          />
          <Input
            label="Monto"
            value={text}
            onChangeText={(next) => setText(groupThousands(next))}
            editable={editable}
            keyboardType="number-pad"
            style={[type.title, { fontVariant: ['tabular-nums'] }]}
          />
          <DaySelector day={day} onChange={setDay} disabled={!editable} />

          <View style={{ gap: 6 }}>
            <Text style={[type.caption, { color: c.muted }]}>Pagó</Text>
            <View
              accessibilityRole="radiogroup"
              style={{
                flexDirection: 'row',
                padding: space.xs,
                borderRadius: radius.pill,
                backgroundColor: c.surface2,
              }}
            >
              {payers.map((member) => {
                const selected = member.id === paidBy;

                return (
                  <Pressable
                    key={member.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: !editable }}
                    disabled={!editable}
                    onPress={() => setPaidBy(member.id)}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.pill,
                      backgroundColor: selected ? c.surface : 'transparent',
                      elevation: selected ? 1 : 0,
                    }}
                  >
                    <Text style={[type.label, { color: selected ? c.text : c.muted }]}>
                      {member.id === me ? 'Vos' : member.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {participants === 0 && (
            <Text style={[type.label, { color: c.warn, fontWeight: '400' }]}>
              Esa fecha es anterior al grupo: elegí otra.
            </Text>
          )}
          {parsed && participants ? (
            <Text style={[type.label, { color: c.muted, fontWeight: '400' }]}>
              Se divide en partes iguales: {formatArs(parsed / participants)} cada uno.
            </Text>
          ) : null}

          <View style={{ flex: 1 }} />
          {editable && (
            <>
              {id && (
                <Button
                  title="Eliminar gasto"
                  variant="danger"
                  disabled={busy}
                  onPress={() =>
                    Alert.alert('¿Eliminar este gasto?', undefined, [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Eliminar',
                        style: 'destructive',
                        onPress: () =>
                          write(
                            supabase.from('shared_movements').delete().eq('id', id).select('id'),
                          ),
                      },
                    ])
                  }
                />
              )}
              <Button title="Guardar" disabled={busy || !valid} onPress={save} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
