import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import type { Database } from './database.types';

// Expo inlines EXPO_PUBLIC_* at build time, so each one must be read as a literal.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY (see .env.example)',
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // ponytail: the session JSON goes straight into SecureStore. Android has no value size
    // limit; if iOS ever ships, its ~2 KB keychain limit needs the AsyncStorage + AES wrapper
    // from Supabase's Expo guide.
    storage: {
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) => SecureStore.setItemAsync(key, value),
      removeItem: (key) => SecureStore.deleteItemAsync(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// React Native has no window focus events: refresh tokens only while the app is in front.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
