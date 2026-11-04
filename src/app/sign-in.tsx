import { useState } from 'react';
import { Alert, Button, Text, View } from 'react-native';
import { signInWithGoogle } from '@/lib/auth';

// Unstyled on purpose: T3 brings the design.
export default function SignIn() {
  const [busy, setBusy] = useState(false);

  async function onPress() {
    setBusy(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      Alert.alert('No se pudo iniciar sesión', error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      <Text accessibilityRole="header">Evenly</Text>
      <Button title="Continuar con Google" onPress={onPress} disabled={busy} />
    </View>
  );
}
