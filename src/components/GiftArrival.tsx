import { router } from 'expo-router';
import { useState } from 'react';
import { acceptGift, declineGift, dismissGift } from '../data/social/postman';
import { useIncomingGifts } from '../hooks/useSharing';
import { formatDisplayDate } from '../lib/dates';
import { ConfirmSheet } from './ConfirmSheet';
import { GiftFlight, type FlightState } from './GiftFlight';

/**
 * Someone is giving you a page (wherever you are in the app, like AirDrop): who, which day, and what's in it, before
 * anything comes across. Accept and it flies across from their phone into yours, and is stamped kept.
 */
export function GiftArrival() {
  const gifts = useIncomingGifts();
  const [problem, setProblem] = useState('');
  const [hidden, setHidden] = useState<string | null>(null);
  const gift = gifts[0];
  if (!gift) return null;
  const what = [gift.photo ? 'a photo' : null, gift.voice ? 'a recording' : null].filter(Boolean).join(' and ');
  const day = formatDisplayDate(gift.date);
  if (gift.state === 'waiting' && gift.changed)
    return (
      <ConfirmSheet
        visible
        title={`${gift.name}'s phone has changed`}
        message={`Someone is giving you a page as ${gift.name}, but not from the phone you added. If they got a new phone or reinstalled LookBack, scan their code again (Shared → Scan), then they can give it again.`}
        confirmLabel="OK"
        confirmIcon="shield-checkmark-outline"
        cancelLabel="Close"
        onConfirm={() => void declineGift(gift.gift)}
        onCancel={() => void declineGift(gift.gift)}
      />
    );
  if (gift.state === 'waiting')
    return (
      <ConfirmSheet
        visible
        title={`${gift.name} has a page for you`}
        message={`A page from ${day}${what ? `, with ${what}` : ''}. It comes straight from their phone to yours.${problem ? `\n\n${problem}` : ''}`}
        confirmLabel="Accept"
        confirmIcon="mail-open-outline"
        cancelLabel="Not now"
        onConfirm={() => {
          setProblem('');
          acceptGift(gift.gift).catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)));
        }}
        onCancel={() => void declineGift(gift.gift)}
      />
    );
  const state: FlightState = gift.state === 'kept' ? 'done' : gift.state === 'failed' ? 'failed' : gift.progress > 0 ? 'moving' : 'connecting';
  const close = () => {
    if (gift.state === 'receiving') setHidden(gift.gift);
    else dismissGift(gift.gift);
  };
  return (
    <GiftFlight
      visible={hidden !== gift.gift || gift.state !== 'receiving'}
      direction="in"
      personId={gift.from}
      name={gift.name}
      title={day}
      line={what ? `a page for you, with ${what}` : 'a page for you'}
      state={state}
      progress={gift.progress}
      problem={gift.problem}
      onClose={close}
      onOpen={() => {
        dismissGift(gift.gift);
        router.push(`/letter/${gift.gift}`);
      }}
    />
  );
}
