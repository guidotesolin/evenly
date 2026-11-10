import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

// Menu's "Mostrar dólares" (ARCHITECTURE.md § Screens 5): per phone, on by default. Off hides
// every dollar figure in the app. A store rather than state because the menu is a sheet over the
// screen that has to react.

const key = 'showUsd';
let showUsd = true;

// A toggle before the stored value finishes loading wins over it (like the theme's `picked`).
let toggled = false;
const listeners = new Set<() => void>();

function emit(value: boolean) {
  showUsd = value;
  listeners.forEach((listener) => listener());
}

/** Applied at startup, like the theme. */
export async function loadShowUsd(): Promise<void> {
  const stored = await SecureStore.getItemAsync(key);

  if (stored !== null && !toggled) emit(stored === 'true');
}

export async function setShowUsd(value: boolean): Promise<void> {
  toggled = true;
  emit(value);
  await SecureStore.setItemAsync(key, String(value));
}

export function useShowUsd(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    () => showUsd,
  );
}
