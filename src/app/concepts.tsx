import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Button, IconButton, Input, Screen, Sheet } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { radius, space, touch, type, useColors } from '@/theme';

// Conceptos: add, rename, archive, pick an emoji and mark as shared.

type Concept = { id: string; name: string; emoji: string | null; is_shared: boolean };

// ponytail: the emoji field takes any text and stores it trimmed; no single-grapheme check.
// Add one (Intl.Segmenter) if letters typed there ever become a problem.
const emojiOrNull = (text: string) => text.trim() || null;

async function fetchConcepts(): Promise<Concept[]> {
  const { data, error } = await supabase
    .from('fixed_concepts')
    .select('id, name, emoji, is_shared')
    .is('archived_at', null)
    .order('name');

  if (error) throw error;

  return data;
}

export default function Concepts() {
  const c = useColors();
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [emoji, setEmoji] = useState('');
  const [name, setName] = useState('');

  // The edit sheet changes emoji and name together and saves on Guardar, so nothing typed is
  // lost by leaving the screen. `editing` outlives the sheet so its fields don't blank out
  // during the fade.
  const [editing, setEditing] = useState<{ concept: Concept; focus: 'emoji' | 'name' } | null>(
    null,
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [newEmoji, setNewEmoji] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  // State updates land on the next render; the ref stops a double tap from writing twice.
  const writing = useRef(false);

  const load = useCallback(
    () =>
      fetchConcepts()
        .then(setConcepts)
        .catch((error: Error) => Alert.alert('Error', error.message)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  /** Runs a write, then reloads the list; `true` if it worked. */
  async function write(request: () => PromiseLike<{ error: Error | null }>): Promise<boolean> {
    if (writing.current) return false;

    writing.current = true;
    setBusy(true);
    const { error } = await request();

    writing.current = false;
    setBusy(false);

    if (error) {
      Alert.alert('Error', error.message);

      return false;
    }

    await load();

    return true;
  }

  async function add() {
    const added = await write(() =>
      supabase.from('fixed_concepts').insert({ name: name.trim(), emoji: emojiOrNull(emoji) }),
    );

    if (added) {
      setName('');
      setEmoji('');
    }
  }

  function edit(concept: Concept, focus: 'emoji' | 'name') {
    setNewEmoji(concept.emoji ?? '');
    setNewName(concept.name);
    setEditing({ concept, focus });
    setSheetOpen(true);
  }

  async function saveEdit() {
    if (!editing) return;

    const saved = await write(() =>
      supabase
        .from('fixed_concepts')
        .update({ name: newName.trim(), emoji: emojiOrNull(newEmoji) })
        .eq('id', editing.concept.id),
    );

    if (saved) setSheetOpen(false);
  }

  function archive(concept: Concept) {
    Alert.alert(
      `¿Archivar ${concept.name}?`,
      'Deja de aparecer en los meses nuevos. Los montos cargados se conservan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: () =>
            write(() =>
              supabase
                .from('fixed_concepts')
                .update({ archived_at: new Date().toISOString() })
                .eq('id', concept.id),
            ),
        },
      ],
    );
  }

  return (
    <Screen edges={['bottom']} style={{ padding: 0, gap: 0 }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Conceptos',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: c.bg },
          headerTitleStyle: type.title,
          // The native back button can't take a label; this one says "Volver".
          headerLeft: () => (
            <IconButton
              glyph="←"
              label="Volver"
              onPress={() => router.back()}
              size={24}
              color={c.text}
            />
          ),
        }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
          <View style={{ width: 56 }}>
            <Input
              label="Emoji"
              value={emoji}
              onChangeText={setEmoji}
              style={{ paddingHorizontal: 0, textAlign: 'center', fontSize: 22 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Nuevo concepto"
              placeholder="Ej.: Gimnasio"
              value={name}
              onChangeText={setName}
              onSubmitEditing={() => name.trim() && add()}
            />
          </View>
          <Button title="Agregar" onPress={add} disabled={busy || !name.trim()} />
        </View>

        <View style={{ borderRadius: radius.field, overflow: 'hidden' }}>
          {concepts.map((concept) => (
            <View
              key={concept.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.xs,
                minHeight: 64,
                paddingVertical: space.xs,
                paddingLeft: space.sm,
                paddingRight: space.xs,
                backgroundColor: c.surface,
                borderBottomWidth: 1,
                borderBottomColor: c.line,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Cambiar emoji de ${concept.name}`}
                onPress={() => edit(concept, 'emoji')}
                style={{
                  width: touch,
                  height: touch,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: concept.emoji ? 'transparent' : c.muted,
                    backgroundColor: c.surface2,
                    color: c.muted,
                    textAlign: 'center',
                    textAlignVertical: 'center',
                    fontSize: 20,
                    fontWeight: '500',
                    overflow: 'hidden',
                  }}
                >
                  {concept.emoji ?? concept.name.charAt(0).toUpperCase()}
                </Text>
              </Pressable>
              <Text style={[type.body, { flex: 1, color: c.text }]}>{concept.name}</Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={[type.caption, { color: c.muted, fontWeight: '400' }]}>
                  Compartido
                </Text>
                <Switch
                  accessibilityLabel={`Compartido: ${concept.name}`}
                  value={concept.is_shared}
                  disabled={busy}
                  trackColor={{ true: c.accent, false: c.line }}
                  thumbColor={c.surface}
                  onValueChange={async (isShared) => {
                    // Flip it now so the switch doesn't snap back while saving; a failed write
                    // reloads the stored value.
                    setConcepts((list) =>
                      list.map((item) =>
                        item.id === concept.id ? { ...item, is_shared: isShared } : item,
                      ),
                    );

                    const saved = await write(() =>
                      supabase
                        .from('fixed_concepts')
                        .update({ is_shared: isShared })
                        .eq('id', concept.id),
                    );

                    if (!saved) await load();
                  }}
                />
              </View>
              <IconButton
                glyph="✎"
                label={`Renombrar ${concept.name}`}
                onPress={() => edit(concept, 'name')}
              />
              <IconButton
                glyph="⊖"
                label={`Archivar ${concept.name}`}
                onPress={() => archive(concept)}
              />
            </View>
          ))}
        </View>

        <Text style={[type.caption, { color: c.muted, fontWeight: '400' }]}>
          Un concepto compartido es un gasto que pagás vos para la casa: cada monto que cargues
          aparece en Compartidos. Cambiarlo afecta solo los montos que cargues desde ahora.
        </Text>
        <Text style={[type.caption, { color: c.muted, fontWeight: '400' }]}>
          Tocá el círculo para elegir un emoji. Es opcional: sin emoji se muestra la inicial.
        </Text>
      </ScrollView>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Editar concepto">
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ width: 56 }}>
            <Input
              // Remount on open so autoFocus lands on the field that was tapped.
              key={`emoji-${sheetOpen}`}
              label="Emoji"
              value={newEmoji}
              onChangeText={setNewEmoji}
              autoFocus={editing?.focus === 'emoji'}
              style={{ paddingHorizontal: 0, textAlign: 'center', fontSize: 22 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              key={`name-${sheetOpen}`}
              label="Nombre"
              value={newName}
              onChangeText={setNewName}
              autoFocus={editing?.focus === 'name'}
            />
          </View>
        </View>
        <Button title="Guardar" disabled={busy || !newName.trim()} onPress={saveEdit} />
      </Sheet>
    </Screen>
  );
}
