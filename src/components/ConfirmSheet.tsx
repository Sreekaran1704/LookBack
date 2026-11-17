import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useTheme, withAlpha } from '../theme';
import { PillButton, type IconName } from './Buttons';
import { HAND_TAIL, Panel } from './Screen';
import { Buddy, type BuddyMood } from './scrapbook/Buddy';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmIcon?: IconName;
  cancelLabel?: string;
  mood?: BuddyMood;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A question asked on paper instead of a system dialog: a taped card on a dimmed page, the bunny
 * peeking over its top, and two pills (the quiet one keeps things as they are). Tapping outside or the
 * back button is the same as the quiet pill.
 */
export function ConfirmSheet({ visible, title, message, confirmLabel, confirmIcon, cancelLabel = 'Keep it', mood = 'peek', onConfirm, onCancel }: Props) {
  const theme = useTheme();
  const { colors, spacing, sizes, typography, nav } = theme;
  const reduceMotion = useReducedMotion();
  const buddy = sizes.buddy * 1.15;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onCancel}>
      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(theme.motion.imageFadeMs)} style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.paper.darkDeep, 0.55) }]}>
        <Pressable accessibilityLabel={cancelLabel} onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View pointerEvents="box-none" style={[styles.center, { padding: spacing.gutter }]}>
          <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(14)} style={{ alignSelf: 'stretch' }}>
            {/* The peek picture ends just under its eyes: let it rest on the card's edge, not behind it. */}
            <View style={{ alignItems: 'flex-end', paddingRight: spacing.xl, marginBottom: -buddy * 0.02 }}>
              <Buddy mood={mood} size={buddy} accent={nav.tape} />
            </View>
            <Panel seed="confirm" accent={nav.tape} accent2={nav.tape2}>
              <Text style={[typography.heading, { color: colors.ink }]}>
                {title}
                {HAND_TAIL}
              </Text>
              <Text style={[typography.caption, { color: colors.inkMuted, marginTop: spacing.sm }]}>{message}</Text>
              <View style={[styles.row, { gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
                <PillButton label={cancelLabel} icon="heart-outline" grow onPress={onCancel} />
                <PillButton label={confirmLabel} icon={confirmIcon} tone="dark" grow onPress={onConfirm} />
              </View>
            </Panel>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row' },
});
