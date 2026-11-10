import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { entriesRepository, settingsRepository, type Entry, type ReminderSettings } from '../data';
import { toLocalDate } from '../lib/dates';

/** Runs `load` now and whenever `subscribe` reports a change. */
function useLiveQuery<T>(
  load: () => Promise<T>,
  subscribe: (listener: () => void) => () => void,
): { data: T | undefined; error: unknown; reload: () => void } {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();

  const reload = useCallback(() => {
    load().then(
      (value) => {
        setData(value);
        setError(undefined);
      },
      (e: unknown) => setError(e),
    );
  }, [load]);

  useEffect(() => {
    reload();
    return subscribe(reload);
  }, [reload, subscribe]);

  return { data, error, reload };
}

/*
 * Every entry, kept in memory and shared by all screens. It is loaded once (during the intro, see
 * preloadEntries) and refreshed whenever the repository reports a change, so opening a screen shows
 * its memories in the first frame instead of waiting on SQLite.
 */
let entriesSnapshot: Entry[] | undefined;
let loadSeq = 0;
let inflight: Promise<Entry[]> | null = null;
let wired = false;
const entryListeners = new Set<() => void>();

function refreshEntries(): Promise<Entry[]> {
  const seq = ++loadSeq;
  const load = entriesRepository.getAll().then((entries) => {
    // A slower, older load must not overwrite a newer one.
    if (seq === loadSeq) {
      entriesSnapshot = entries;
      entryListeners.forEach((listener) => listener());
    }
    return entries;
  });
  inflight = load;
  load.then(
    () => {
      if (inflight === load) inflight = null;
    },
    (error: unknown) => {
      if (inflight === load) inflight = null;
      console.warn('[entries] load failed', error);
    },
  );
  return load;
}

function ensureEntries(): Promise<Entry[]> {
  if (!wired) {
    wired = true;
    entriesRepository.subscribe(() => {
      refreshEntries();
    });
  }
  if (entriesSnapshot) return Promise.resolve(entriesSnapshot);
  return inflight ?? refreshEntries();
}

/** Starts loading every entry into memory. Await it before showing the first screen. */
export function preloadEntries(): Promise<Entry[]> {
  return ensureEntries();
}

function subscribeEntries(listener: () => void): () => void {
  entryListeners.add(listener);
  ensureEntries().catch(() => undefined);
  return () => {
    entryListeners.delete(listener);
  };
}

const getEntriesSnapshot = () => entriesSnapshot;

/** All entries, newest first. `undefined` only until the first load finishes. */
export function useAllEntries(): { data: Entry[] | undefined } {
  return { data: useSyncExternalStore(subscribeEntries, getEntriesSnapshot) };
}

/** One year's entries, newest first, from the shared in-memory list. */
export function useYearEntries(year: number): { data: Entry[] | undefined } {
  const { data } = useAllEntries();
  return { data: useMemo(() => data?.filter((e) => e.localDate.startsWith(`${year}-`)), [data, year]) };
}

/** One entry: `undefined` while loading, `null` if it doesn't exist. */
export function useEntry(id: string): { data: Entry | null | undefined } {
  const { data } = useAllEntries();
  return { data: useMemo(() => (data ? (data.find((e) => e.id === id) ?? null) : undefined), [data, id]) };
}

export function useReminderSettings() {
  return useLiveQuery<ReminderSettings>(settingsRepository.getReminder, settingsRepository.subscribe);
}

/** Today's local date; updates when the app comes back to the foreground on a new day. */
export function useToday(): string {
  const [today, setToday] = useState(toLocalDate);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(toLocalDate());
    });
    return () => sub.remove();
  }, []);
  return today;
}
