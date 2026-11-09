import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { Button, Card, Input, InviteCode, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { space, type, useColors } from '@/theme';

export default function HouseholdSetup() {
  const c = useColors();
  const { refreshHousehold } = useAuth();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const { data, error } = await supabase.rpc('create_household', { household_name: name.trim() });

    setBusy(false);

    if (error) {
      Alert.alert('No se pudo crear el grupo', error.message);

      return;
    }

    // Show the code before moving on: the guard would otherwise jump to the tabs at once.
    setInviteCode(data.invite_code);
  }

  async function join() {
    setBusy(true);
    const { error } = await supabase.rpc('join_household', { code: code.trim() });

    if (error) {
      setBusy(false);
      Alert.alert('No se pudo unir al grupo', error.message);

      return;
    }

    await refreshHousehold().catch((cause: Error) => Alert.alert('Error', cause.message));

    setBusy(false);
  }

  if (inviteCode) {
    return (
      <Screen style={{ justifyContent: 'space-between', padding: space.xl }}>
        <View style={{ gap: space.sm, paddingTop: space.xxl }}>
          <Text accessibilityRole="header" style={[type.title, { color: c.text }]}>
            Grupo creado
          </Text>
          <Text style={[type.body, { color: c.muted }]}>
            Compartí este código para que se unan:
          </Text>
        </View>
        <InviteCode code={inviteCode} />
        <Button
          title="Continuar"
          disabled={busy}
          onPress={() => {
            setBusy(true);
            refreshHousehold().catch((cause: Error) => {
              setBusy(false);
              Alert.alert('Error', cause.message);
            });
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      {/* Edge-to-edge Android doesn't resize for the keyboard: without this, the keyboard covers
          the join code field and its button. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.xl, gap: space.xl }}
        >
          <View style={{ gap: space.sm, paddingTop: space.xxl }}>
            <Text accessibilityRole="header" style={[type.title, { color: c.text }]}>
              Tu grupo familiar
            </Text>
            <Text style={[type.body, { color: c.muted }]}>
              Creá un grupo nuevo o unite a uno con el código que te pasaron.
            </Text>
          </View>

          <Card>
            <Text style={[type.body, { fontWeight: '500', color: c.text }]}>
              Crear un grupo nuevo
            </Text>
            <Input
              label="Nombre del grupo"
              placeholder="Ej.: Casa"
              value={name}
              onChangeText={setName}
            />
            <Button title="Crear grupo" onPress={create} disabled={busy || !name.trim()} />
          </Card>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
            <Text style={[type.label, { color: c.muted, fontWeight: '400' }]}>o</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
          </View>

          <Card>
            <Text style={[type.body, { fontWeight: '500', color: c.text }]}>
              Unirme con un código
            </Text>
            <Input
              label="Código de invitación"
              placeholder="ABC123"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              style={{ fontSize: 18, fontWeight: '500', letterSpacing: 4 }}
            />
            <Button
              title="Unirme"
              variant="secondary"
              onPress={join}
              disabled={busy || code.trim().length < 6}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
