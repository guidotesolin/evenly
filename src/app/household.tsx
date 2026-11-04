import { useState } from 'react';
import { Alert, Button, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Unstyled on purpose: T3 brings the design.
export default function HouseholdSetup() {
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
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text>Grupo creado. Compartí este código para que se unan:</Text>
        <Text selectable style={{ fontSize: 32 }}>
          {inviteCode}
        </Text>
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
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      <Text accessibilityRole="header">Tu grupo familiar</Text>

      <Text>Crear un grupo nuevo</Text>
      <TextInput
        placeholder="Nombre del grupo"
        value={name}
        onChangeText={setName}
        style={{ borderWidth: 1, padding: 8 }}
      />
      <Button title="Crear" onPress={create} disabled={busy || !name.trim()} />

      <Text>O unirte con un código</Text>
      <TextInput
        placeholder="Código de invitación"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        style={{ borderWidth: 1, padding: 8 }}
      />
      <Button title="Unirme" onPress={join} disabled={busy || code.trim().length < 6} />
    </View>
  );
}
