import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { EASE_OUT } from '../components/transitions';

/** How long a page takes to zoom open from what you tapped. */
export const APP_OPEN_MS = 300;

/**
 * A page that opens like an app on a Samsung phone: it grows out of the thing you tapped (its point on screen, passed
 * as `x`/`y` route params) until it fills the screen. Leaving is instant (no animation). Runs entirely on the UI thread. `ready` turns true one frame after it
 * has opened: build the heavy part of the page then, so nothing competes with the zoom. Its stack screen should use
 * `animation: 'none'` (this is the animation). Reduce motion: a short fade.
 */
export function useAppOpen(origin: { x?: string | string[]; y?: string | string[] }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const num = (v: string | string[] | undefined, fallback: number) => {
    const n = Number(Array.isArray(v) ? v[0] : v);
    return Number.isFinite(n) ? n : fallback;
  };
  const ox = num(origin.x, width / 2);
  const oy = num(origin.y, height / 2);
  const p = useSharedValue(0);
  const [ready, setReady] = useState(false);

  // The zoom starts only once the page has been laid out and its first frame drawn: building the page took ~175 ms
  // of frames (measured), and when that landed inside the zoom it jumped. Put `onLayout` on the page's view.
  const [laidOut, setLaidOut] = useState(false);
  const onLayout = () => setLaidOut(true);
  useEffect(() => {
    if (!laidOut) return;
    let frame = requestAnimationFrame(() => {
      p.set(withTiming(1, { duration: reduceMotion ? 160 : APP_OPEN_MS, easing: EASE_OUT }));
    });
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(() => setReady(true));
    }, (reduceMotion ? 160 : APP_OPEN_MS) + 20);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [laidOut, p, reduceMotion]);

  // Leaving needs no animation: straight back to where you were (the phone's back does the same on its own).
  const close = () => router.back();

  const animated = useAnimatedStyle(() => {
    const t = p.get();
    if (reduceMotion) return { flex: 1, opacity: t };
    // No rounded clipping: it made Android draw the whole page off screen every frame (measured ~35% janky).
    return {
      flex: 1,
      opacity: Math.min(1, t * 2.2),
      transform: [{ scale: 0.18 + 0.82 * t }],
    };
  });

  // Where it grows from never changes, so it isn't animated (only scale and opacity, Reanimated's fast path).
  const style = [{ flex: 1, transformOrigin: `${ox}px ${oy}px` }, animated];

  /**
   * Put on the page's Animated.View as `renderToHardwareTextureAndroid`: while it zooms the page is drawn once into a
   * GPU texture and only scaled (nothing inside it moves until `ready`), instead of re-drawing every shadow each frame.
   */
  const layer = !ready;

  return { style, ready, close, layer, onLayout };
}
