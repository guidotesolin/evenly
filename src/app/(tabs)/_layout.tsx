import { Tabs } from 'expo-router';
import { Alert, Button } from 'react-native';
import { signOut } from '@/lib/auth';

// ponytail: the "menu" is a native Alert with one action. Replace with a real menu when it
// grows a second entry (T3 decides the component).
function HeaderMenu() {
  return (
    <Button
      title="⋮"
      accessibilityLabel="Menú"
      onPress={() =>
        Alert.alert('Evenly', undefined, [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Cerrar sesión',
            onPress: () =>
              signOut().catch((error: Error) =>
                Alert.alert('No se pudo cerrar sesión', error.message),
              ),
          },
        ])
      }
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerRight: HeaderMenu }}>
      <Tabs.Screen name="index" options={{ title: 'Fijos' }} />
      <Tabs.Screen name="shared" options={{ title: 'Compartidos' }} />
    </Tabs>
  );
}
