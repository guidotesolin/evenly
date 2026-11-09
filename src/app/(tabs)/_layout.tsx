import Constants from 'expo-constants';
import { router, Tabs } from 'expo-router';
import * as Updates from 'expo-updates';
import { useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Button, IconButton, Row, Sheet } from '@/components/ui';
import { signOut } from '@/lib/auth';
import {
  loadTheme,
  radius,
  saveTheme,
  space,
  touch,
  type,
  useColors,
  type ThemeChoice,
} from '@/theme';

const themes: { choice: ThemeChoice; label: string }[] = [
  { choice: 'system', label: 'Sistema' },
  { choice: 'light', label: 'Claro' },
  { choice: 'dark', label: 'Oscuro' },
];

function HeaderMenu() {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>('system');
  // A tap before the stored choice finishes loading wins over it.
  const picked = useRef(false);

  function pickTheme(choice: ThemeChoice) {
    picked.current = true;
    setTheme(choice);
    saveTheme(choice).catch((error: Error) => Alert.alert('Error', error.message));
  }

  return (
    <>
      <IconButton
        glyph="⋮"
        label="Menú"
        size={22}
        color={c.text}
        onPress={() => {
          picked.current = false;
          loadTheme()
            .catch(() => 'system' as const)
            .then((stored) => {
              if (!picked.current) setTheme(stored);
            });
          setOpen(true);
        }}
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Evenly">
        <View style={{ borderRadius: radius.field, overflow: 'hidden' }}>
          {(
            [
              ['Grupo familiar', '/members'],
              ['Evolución de fijos', '/history'],
            ] as const
          ).map(([title, route]) => (
            <Row
              key={route}
              title={title}
              right={<Text style={[type.title, { color: c.muted }]}>›</Text>}
              onPress={() => {
                setOpen(false);
                router.push(route);
              }}
            />
          ))}
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={[type.caption, { color: c.muted }]}>Tema</Text>
          <View
            accessibilityRole="radiogroup"
            style={{
              flexDirection: 'row',
              padding: space.xs,
              borderRadius: radius.pill,
              backgroundColor: c.surface2,
            }}
          >
            {themes.map(({ choice, label }) => {
              const selected = theme === choice;

              return (
                <Pressable
                  key={choice}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => pickTheme(choice)}
                  style={{
                    flex: 1,
                    minHeight: touch - space.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.pill,
                    backgroundColor: selected ? c.accent : 'transparent',
                  }}
                >
                  <Text style={[type.label, { color: selected ? c.onAccent : c.text }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Button
          title="Cerrar sesión"
          variant="danger"
          onPress={() => {
            setOpen(false);
            signOut().catch((error: Error) =>
              Alert.alert('No se pudo cerrar sesión', error.message),
            );
          }}
        />

        {/* The binary's version, plus the OTA update's short id when one is running, so a
            JS-only update can be told apart. The bundle inside the APK shows no id. */}
        <Text style={[type.caption, { color: c.muted, fontWeight: '400', textAlign: 'center' }]}>
          Versión {Constants.expoConfig?.version}
          {!Updates.isEmbeddedLaunch && Updates.updateId
            ? ` · ${Updates.updateId.slice(0, 8)}`
            : ''}
        </Text>
      </Sheet>
    </>
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
