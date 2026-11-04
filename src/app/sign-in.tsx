import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Screen } from '@/components/ui';
import { signInWithGoogle } from '@/lib/auth';
import { radius, space, type, useColors } from '@/theme';

export default function SignIn() {
  const c = useColors();
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
    <Screen style={{ justifyContent: 'space-between', padding: space.xl }}>
      <View />
      <View style={{ gap: space.md }}>
        {/* Logo: two equal bars, "even". */}
        <View
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.sheet,
            backgroundColor: c.accent,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <View style={{ width: 28, height: 3, borderRadius: 2, backgroundColor: c.onAccent }} />
          <View style={{ width: 28, height: 3, borderRadius: 2, backgroundColor: c.onAccent }} />
        </View>
        <Text accessibilityRole="header" style={[type.display, { color: c.text }]}>
          Evenly
        </Text>
        <Text style={[type.body, { color: c.muted }]}>
          Los gastos de la casa, en un solo lugar.
        </Text>
      </View>
      <View style={{ gap: space.md }}>
        <Button
          title="Continuar con Google"
          variant="secondary"
          onPress={onPress}
          disabled={busy}
        />
        <Text style={[type.caption, { color: c.muted, textAlign: 'center', fontWeight: '400' }]}>
          Usá tu cuenta de Google. No hace falta contraseña.
        </Text>
      </View>
    </Screen>
  );
}
