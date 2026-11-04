import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { session, householdId } = useAuth();
  const ready = session !== undefined && householdId !== undefined;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Keep the splash up until we know where to land; otherwise the guards flicker.
  if (!ready) return null;

  const signedIn = session !== null;
  const hasHousehold = householdId !== null;

  return (
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
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}
