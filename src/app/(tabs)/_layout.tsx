import { router, Tabs } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { Button, IconButton } from '@/components/ui';
import { signOut } from '@/lib/auth';
import { type, useColors } from '@/theme';

// ponytail: the "menu" is a native Alert with one action. Replace with a real menu when it
// grows a second entry.
function HeaderMenu() {
  const c = useColors();

  return (
    <IconButton
      glyph="⋮"
      label="Menú"
      size={22}
      color={c.text}
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
        // The default tab button's ripple is borderless, so without icons it spreads as a circle
        // far past the small label. This one fills the tab and stays inside it.
        tabBarButton: ({ ref: _ref, ...props }) => (
          <Pressable {...props} android_ripple={{ color: c.line, foreground: true }} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Fijos',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Button title="Conceptos" variant="text" onPress={() => router.push('/concepts')} />
              <HeaderMenu />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="shared" options={{ title: 'Compartidos' }} />
    </Tabs>
  );
}
