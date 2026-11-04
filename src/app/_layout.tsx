import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useNavigationTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { session, householdId } = useAuth();
  const navigationTheme = useNavigationTheme();
  const ready = session !== undefined && householdId !== undefined;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Keep the splash up until we know where to land; otherwise the guards flicker.
  if (!ready) return null;

  const signedIn = session !== null;
  const hasHousehold = householdId !== null;

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !hasHousehold}>
          <Stack.Screen name="household" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && hasHousehold}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}
