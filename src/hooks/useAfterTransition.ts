import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';

/**
 * False while this screen is sliding in, true once it has arrived. Heavy screens render a few items
 * first and the rest after this flips, so the slide stays smooth. Falls back to a timer in case the
 * transition event never comes (e.g. the screen is the first one shown).
 */
export function useAfterTransition(fallbackMs: number): boolean {
  const navigation = useNavigation();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done) return;
    const finish = () => setDone(true);
    const timer = setTimeout(finish, fallbackMs);
    const unsubscribe = navigation.addListener('transitionEnd' as never, finish);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [navigation, fallbackMs, done]);
  return done;
}
