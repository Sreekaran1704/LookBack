import { useEffect, useState, useSyncExternalStore } from 'react';
import { addBackRequests, gonePeople, incomingGifts, outgoingHeard, outgoingProblem, outgoingProgress, outgoingState, subscribePostman, type GiftProblem, type GiftState, type IncomingGift } from '../data/social/postman';
import { sharingRepository, type ChatRow, type GivenPage, type OutboxItem, type Person, type Reaction, type ReceivedLetter } from '../data/sharingRepository';

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
/** Every reaction (yours and your people's), latest per person and thing. */
export const useReactions = (): Reaction[] => useShared(() => sharingRepository.reactions(), EMPTY);
/** Unread messages per person. */
export const useUnreadMessages = (): Map<string, number> => useShared(() => sharingRepository.unreadMessages(), NO_UNREAD);
const NO_UNREAD = new Map<string, number>();
/** The chat with one person, oldest first (reactions in flight aren't shown as messages). */
export function useMessages(personId: string): ChatRow[] {
  const [value, setValue] = useState<ChatRow[]>(EMPTY);
  useEffect(() => {
    let live = true;
    const load = () => void sharingRepository.messages(personId).then((v) => live && setValue(v.filter((m) => m.kind === 'text' || m.kind === 'voice')), () => undefined);
    load();
    const unsubscribe = sharingRepository.subscribe(load);
    return () => {
      live = false;
      unsubscribe();
    };
  }, [personId]);
  return value;
}
/** The pages you gave one person, newest first, again whenever anything changes. */
export function useGivenPages(personId: string): GivenPage[] {
  const [value, setValue] = useState<GivenPage[]>(EMPTY);
  useEffect(() => {
    let live = true;
    const load = () => void sharingRepository.given(personId).then((v) => live && setValue(v), () => undefined);
    load();
    const unsubscribe = sharingRepository.subscribe(load);
    return () => {
      live = false;
      unsubscribe();
    };
  }, [personId]);
  return value;
}
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
/** Their phone heard the knock and is asking them (the giver waits for their Accept). */
export function useGiftHeard(giftId: string | null): boolean {
  return useSyncExternalStore(subscribePostman, () => (giftId ? outgoingHeard(giftId) : false));
}

let addBackSnapshot = addBackRequests();
/** The same array as long as the same people are asking, so useSyncExternalStore sees no change. */
function readAddBack() {
  const next = addBackRequests();
  if (next.length !== addBackSnapshot.length || next.some((r, i) => r.id !== addBackSnapshot[i]?.id)) addBackSnapshot = next;
  return addBackSnapshot;
}
/** People who added you but aren't among your people yet ("Asha added you · Add back"). */
export function useAddBackRequests(): ReturnType<typeof addBackRequests> {
  return useSyncExternalStore(subscribePostman, readAddBack);
}
