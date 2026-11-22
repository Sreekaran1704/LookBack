import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  allowNearby,
  bluetoothReady,
  heardTokens,
  nearbySupported,
  startAnnouncing,
  startListening,
  stopAnnouncing,
  stopListening,
} from '../../modules/lookback-nearby';
import { announceNearby, leaveNearby, namesNearby, type NearbyPerson } from '../data/social/nearby';

/** Where nearby stands on this phone: not possible here, waiting on a permission or Bluetooth, or working. */
export type NearbyState = 'unsupported' | 'starting' | 'needs-permission' | 'bluetooth-off' | 'on' | 'offline';

/** The server forgets a presence after 10 minutes; announce again a little before. */
const REANNOUNCE_MS = 8 * 60 * 1000;
/** While the server can't be reached, try again this often. */
const OFFLINE_RETRY_MS = 8000;
/** How often the giver looks at what it has heard. */
const LISTEN_TICK_MS = 1500;

function newToken(): string {
  return Array.from(Crypto.getRandomBytes(8), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Checks the permission and Bluetooth, and again whenever the app comes back to the front (from Settings). */
/** Where nearby stands right now (asks for the permission if it hasn't been answered). */
async function nearbyState(): Promise<NearbyState> {
  if (!nearbySupported) return 'unsupported';
  if (!(await allowNearby())) return 'needs-permission';
  return bluetoothReady() ? 'on' : 'bluetooth-off';
}

function useNearbyReady(enabled: boolean): [NearbyState, () => void] {
  const [state, setState] = useState<NearbyState>(nearbySupported ? 'starting' : 'unsupported');
  const check = useCallback(() => {
    void nearbyState().then(setState);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [enabled, check]);
  return [state, check];
}

/**
 * Be visible to people nearby while `enabled` (the receiving page is open and you're signed in): a fresh random token,
 * registered with your name on the server and announced over Bluetooth. Stops (and leaves) when disabled or closed. A
 * change of name (the profile loading after the page) announces again, so others see the name this page shows.
 */
export function useVisibleNearby(enabled: boolean, name: string): [NearbyState, () => void] {
  const [state, recheck] = useNearbyReady(enabled);
  const [attempt, setAttempt] = useState(0);
  // Whether the server took our token: until it has, nobody nearby can find us, so we don't say we're visible.
  const [registered, setRegistered] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enabled || state !== 'on') return;
    let live = true;
    const announce = async () => {
      const token = newToken();
      try {
        await announceNearby(token, name);
        if (!live) return;
        startAnnouncing(token);
        setRegistered(true);
      } catch {
        // Offline (or the server isn't ready): say so; the next round tries again.
        if (live) setRegistered(false);
      }
    };
    void announce();
    const timer = setInterval(() => void announce(), REANNOUNCE_MS);
    return () => {
      live = false;
      clearInterval(timer);
      stopAnnouncing();
      void leaveNearby().catch(() => undefined);
    };
  }, [enabled, state, attempt, name]);
  // Couldn't reach the server: try again on its own every little while (and at once on "Try again").
  useEffect(() => {
    if (registered !== false) return;
    const timer = setTimeout(() => setAttempt((n) => n + 1), OFFLINE_RETRY_MS);
    return () => clearTimeout(timer);
  }, [registered, attempt]);
  const retry = useCallback(() => {
    recheck();
    setAttempt((n) => n + 1);
  }, [recheck]);
  return [state === 'on' && registered === false ? 'offline' : state === 'on' && registered === null ? 'starting' : state, retry];
}

/** The people nearby with the receiving page open, closest first, while `enabled` (the giving page is open). */
export function useNearbyPeople(enabled: boolean): [NearbyState, NearbyPerson[], () => void] {
  const [state, retry] = useNearbyReady(enabled);
  const [people, setPeople] = useState<NearbyPerson[]>([]);
  useEffect(() => {
    if (!enabled || state !== 'on') return;
    let live = true;
    let asked = '';
    let busy = false;
    startListening();
    const tick = async () => {
      const tokens = heardTokens();
      const key = tokens.join(',');
      if (busy || key === asked) return;
      busy = true;
      try {
        const named = await namesNearby(tokens);
        asked = key;
        if (live) setPeople(named);
      } catch {
        // Offline for a moment: keep who we had and try again next tick.
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => void tick(), LISTEN_TICK_MS);
    return () => {
      live = false;
      clearInterval(timer);
      stopListening();
      setPeople([]);
    };
  }, [enabled, state]);
  return [state, people, retry];
}
