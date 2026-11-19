import { Easing, FadeIn, FadeInDown, FadeOut, FadeOutDown, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { motion } from '../theme/tokens';

/**
 * The app's one set of entrances and exits, so everything moves alike: things arrive quickly and settle
 * softly (a long ease-out, no bounce), and leave a little faster. With reduce motion, plain fades.
 */
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_IN = Easing.bezier(0.55, 0, 1, 0.45);

/** A sheet, strip or card rising into place. */
export function sheetIn(reduceMotion: boolean) {
  return reduceMotion ? FadeIn.duration(motion.imageFadeMs) : FadeInDown.duration(motion.sheetInMs).easing(EASE_OUT);
}

export function sheetOut(reduceMotion: boolean) {
  return reduceMotion ? FadeOut.duration(motion.imageFadeMs) : FadeOutDown.duration(motion.sheetOutMs).easing(EASE_IN);
}

/** A step of a flow sliding in from the right, the last one sliding away to the left. */
export function stepIn(reduceMotion: boolean) {
  return reduceMotion ? FadeIn.duration(motion.imageFadeMs) : SlideInRight.duration(motion.screenMs + 60).easing(EASE_OUT);
}

export function stepOut(reduceMotion: boolean) {
  return reduceMotion ? FadeOut.duration(motion.imageFadeMs) : SlideOutLeft.duration(motion.screenMs).easing(EASE_IN);
}
