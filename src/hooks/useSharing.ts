import { useEffect, useState, useSyncExternalStore } from 'react';
import { gonePeople, incomingGifts, outgoingProblem, outgoingProgress, outgoingState, subscribePostman, type GiftProblem, type GiftState, type IncomingGift } from '../data/social/postman';
import { sharingRepository, type OutboxItem, type Person, type ReceivedLetter } from '../data/sharingRepository';

/** Reads something from the sharing tables, again whenever they change. */
function useShared<T>(read: () => Promise<T>, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let live = true;
    const load = () =>
      void read().then(
        (v) => live && setValue(v),
        () => undefined,
      );
    load();
    const unsubscribe = sharingRepository.subscribe(load);
    return () => {
      live = false;
      unsubscribe();
    };
    // `read` is a stable repository method.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}
const EMPTY: never[] = [];
export const usePeople = (): Person[] => useShared(() => sharingRepository.people(), EMPTY);
export const useReceivedLetters = (): ReceivedLetter[] => useShared(() => sharingRepository.letters(), EMPTY);
export const useOutbox = (): OutboxItem[] => useShared(() => sharingRepository.outbox(), EMPTY);
export function useReceivedLetter(id: string): ReceivedLetter | null | undefined {
  const [value, setValue] = useState<ReceivedLetter | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const load = () => void sharingRepository.letter(id).then((v) => live && setValue(v), () => live && setValue(null));
    load();
    const unsubscribe = sharingRepository.subscribe(load);
    return () => {
      live = false;
      unsubscribe();
    };
  }, [id]);
  return value;
}

let snapshot: IncomingGift[] = incomingGifts();
const subscribeIncoming = (onChange: () => void) =>
  subscribePostman(() => {
    snapshot = incomingGifts();
    onChange();
  });
/** Memories people are giving you right now (waiting for your answer, arriving, or just kept). */
export function useIncomingGifts(): IncomingGift[] {
  return useSyncExternalStore(subscribeIncoming, () => snapshot);
}
/** How a gift you're giving is going (null once it's settled and forgotten). */
export function useGiftState(giftId: string | null): GiftState | null {
  return useSyncExternalStore(subscribePostman, () => (giftId ? outgoingState(giftId) : null));
}
/** Account ids of your people whose sharing account no longer exists (they need adding again). */
export function useGonePeople(): ReadonlySet<string> {
  return useSyncExternalStore(subscribePostman, gonePeople);
}
/** Why a gift you're giving is stuck (no Wi-Fi, can't reach them, their phone changed), or null. */
export function useGiftProblem(giftId: string | null): GiftProblem | null {
  return useSyncExternalStore(subscribePostman, () => (giftId ? outgoingProblem(giftId) : null));
}
/** How much of a gift you're giving has gone across, 0–1. */
export function useGiftProgress(giftId: string | null): number {
  return useSyncExternalStore(subscribePostman, () => (giftId ? outgoingProgress(giftId) : 0));
}
