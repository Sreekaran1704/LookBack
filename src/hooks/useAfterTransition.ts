import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';

/**
 * False while this screen is sliding in, true once it has arrived. Heavy screens render a few items
 * first and the rest after this flips, so the slide stays smooth. Falls back to a timer in case the
 * transition event never comes (e.g. the screen is the first one shown): keep the fallback longer than
 * Android's own slide (which ignores the duration we ask for), or it fires mid-slide.
 */
export function useAfterTransition(fallbackMs: number): boolean {
  const navigation = useNavigation();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done) return;
    let frame = 0;
    // One frame after the slide has really finished, so the new work never lands on its last frames.
    const finish = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setDone(true));
    };
    const timer = setTimeout(finish, fallbackMs);
    const unsubscribe = navigation.addListener('transitionEnd' as never, finish);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [navigation, fallbackMs, done]);
  return done;
}
