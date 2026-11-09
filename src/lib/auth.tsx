import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

if (!webClientId) {
  throw new Error('Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (see .env.example)');
}

GoogleSignin.configure({ webClientId });

/** Resolves without signing in when the user cancels the Google dialog. */
export async function signInWithGoogle(): Promise<void> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  if (!isSuccessResponse(response)) return;

  if (!response.data.idToken) throw new Error('Google no devolvió un ID token');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: response.data.idToken,
  });

  if (error) throw error;
}

export async function signOut(): Promise<void> {
  // Also forget the Google account so the next sign-in shows the account picker.
  await GoogleSignin.signOut();
  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}

type AuthState = {
  /** `undefined` while the persisted session is still being read. */
  session: Session | null | undefined;
  /** `undefined` while unknown; `null` when the user has no active household. */
  householdId: string | null | undefined;
  /** Re-reads the membership after `create_household` / `join_household`. */
  refreshHousehold: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

type Membership = { userId: string; householdId: string | null };

async function fetchHouseholdId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .is('left_on', null)
    .maybeSingle();

  if (error) throw error;

  return data?.household_id ?? null;
}

export type Member = { id: string; name: string; active: boolean };

// ponytail: one cached list, refreshed by every fetch; the Compartidos tab fetches on each focus,
// so the expense form opened from it reads this instead of fetching again.
let cache: { householdId: string; members: Member[] } | null = null;

/** The last `fetchMembers` result for this household, if any. */
export function cachedMembers(householdId: string): Member[] | null {
  return cache?.householdId === householdId ? cache.members : null;
}

/** Everyone who ever joined the household (old movements name them), with their first name. */
export async function fetchMembers(householdId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('user_id, left_on, profiles(display_name)')
    .eq('household_id', householdId);

  if (error) throw error;

  const members = data.map((row) => ({
    id: row.user_id,
    // "Pagó Sabrina", not the full Google name.
    name: row.profiles.display_name.trim().split(/\s+/)[0] || row.profiles.display_name,
    active: row.left_on === null,
  }));

  cache = { householdId, members };

  return members;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [membership, setMembership] = useState<Membership | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));

    return () => data.subscription.unsubscribe();
  }, []);

  const refreshHousehold = useCallback(async () => {
    if (userId) setMembership({ userId, householdId: await fetchHouseholdId(userId) });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchHouseholdId(userId)
      .catch(() => null)
      .then((householdId) => setMembership({ userId, householdId }));
  }, [userId]);

  // A membership read for another user (or none yet) counts as unknown.
  let householdId: string | null | undefined;

  if (session === undefined) householdId = undefined;
  else if (!userId) householdId = null;
  else householdId = membership?.userId === userId ? membership.householdId : undefined;

  return (
    <AuthContext.Provider value={{ session, householdId, refreshHousehold }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);

  if (!state) throw new Error('useAuth must be used inside AuthProvider');

  return state;
}
