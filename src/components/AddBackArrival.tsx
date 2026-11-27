import { useState } from 'react';
import { addBack, notNowAddBack } from '../data/social/postman';
import { useAddBackRequests, useIncomingGifts } from '../hooks/useSharing';
import { ConfirmSheet } from './ConfirmSheet';

/**
 * Someone added you (scanned your code, found you nearby, or says hello from their list) but isn't among your people
 * yet: "Asha added you · Add back". Adding them back means their pages come in by themselves and you can give them
 * yours. Waits while a page is being offered (that question comes first).
 */
export function AddBackArrival() {
  const requests = useAddBackRequests();
  const gifts = useIncomingGifts();
  const [problem, setProblem] = useState('');
  const who = requests[0];
  if (!who || gifts.some((g) => g.state === 'waiting' || g.state === 'receiving')) return null;
  return (
    <ConfirmSheet
      visible
      mood="wave"
      title={`${who.name} added you`}
      message={`Add ${who.name} back, so you can give each other pages and theirs come straight in.${problem ? `\n\n${problem}` : ''}`}
      confirmLabel="Add back"
      confirmIcon="person-add-outline"
      cancelLabel="Not now"
      onConfirm={() => {
        setProblem('');
        addBack(who.id).catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)));
      }}
      onCancel={() => void notNowAddBack(who.id)}
    />
  );
}
