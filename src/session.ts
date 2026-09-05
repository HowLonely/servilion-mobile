import * as SecureStore from 'expo-secure-store';

import type { Session } from './types';

const SESSION_KEY = 'servilion.mobile.session.v1';

export async function loadSession(): Promise<Session | null> {
  const stored = await SecureStore.getItemAsync(SESSION_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as Session;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}