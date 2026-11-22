import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { sharingRepository } from '../data/sharingRepository';
import { myAccountId } from '../data/social/repository';
import { parsePersonLink, personLink } from '../lib/personLink';

/**
 * yearbook://add?u=<id>&n=<name>: someone's card, scanned with the phone's own camera (or opened from a message). Adds
 * them to your people and opens Shared.
 */
export default function AddPerson() {
  const { u, n } = useLocalSearchParams<{ u?: string; n?: string }>();
  const person = u ? parsePersonLink(personLink(u, n ?? '')) : null;
  useEffect(() => {
    if (!person) return;
    void myAccountId().then((me) => (me === person.id ? undefined : sharingRepository.addPerson(person.id, person.name)));
  }, [person?.id, person?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Redirect href="/shared" />;
}
