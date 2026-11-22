import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { chunkedSessionStorage } from '../../lib/sessionStorage';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const socialConfigured = Boolean(url && key);
// Sessions stay in the OS keychain. Web sessions deliberately last only for this visit.
const storage = Platform.OS === 'web' ? undefined : chunkedSessionStorage(SecureStore, Crypto.randomUUID);
export const socialClient = socialConfigured
  ? createClient(url, key, {
      auth: { storage, persistSession: Platform.OS !== 'web', autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;
if (socialClient) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') socialClient.auth.startAutoRefresh();
    else socialClient.auth.stopAutoRefresh();
  });
}
export function requireSocial() {
  if (!socialClient) throw new Error('Sharing is not connected yet. Your private diary still works.');
  return socialClient;
}
