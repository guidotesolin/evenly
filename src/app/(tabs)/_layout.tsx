import { Tabs } from 'expo-router';
import { Alert, Pressable, Text } from 'react-native';
import { signOut } from '@/lib/auth';
import { touch, type, useColors } from '@/theme';

// ponytail: the "menu" is a native Alert with one action. Replace with a real menu when it
// grows a second entry.
function HeaderMenu() {
  const c = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Menú"
      android_ripple={{ color: c.line, borderless: true }}
      style={{ width: touch, height: touch, alignItems: 'center', justifyContent: 'center' }}
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
    >
      <Text style={{ fontSize: 22, lineHeight: 24, fontWeight: '700', color: c.text }}>⋮</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const c = useColors();

  return (
    <Tabs
      screenOptions={{
        headerRight: HeaderMenu,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.bg },
        headerTitleStyle: type.title,
        sceneStyle: { backgroundColor: c.bg },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: type.label,
        // ponytail: label-only tabs; the design draws icons. Add them with @expo/vector-icons
        // (or native tabs' `md` icons) when the extra dependency is worth it.
        tabBarIconStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Fijos' }} />
      <Tabs.Screen name="shared" options={{ title: 'Compartidos' }} />
    </Tabs>
  );
}
