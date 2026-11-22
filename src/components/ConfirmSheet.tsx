import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { sheetIn } from './transitions';
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
  /** Only the quiet button (something is under way, or there's nothing to decide). */
  single?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A question asked on paper instead of a system dialog: a diary page on the dimmed leather, the diary's stamp
 * resting on its top edge, and two buttons (the quiet one keeps things as they are). Tapping outside or the back
 * button is the same as the quiet one.
 */
export function ConfirmSheet({ visible, title, message, confirmLabel, confirmIcon, cancelLabel = 'Keep it', mood = 'peek', single = false, onConfirm, onCancel }: Props) {
  const theme = useTheme();
  const { colors, spacing, sizes, typography } = theme;
  const reduceMotion = useReducedMotion();
  const stamp = sizes.buddy * 0.9;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onCancel}>
      {/* The dimmed page fades in and out with the dialog (the Modal's fade); the card eases up into place. */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.paper.darkDeep, 0.55) }]}>
        <Pressable accessibilityLabel={cancelLabel} onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View pointerEvents="box-none" style={[styles.center, { padding: spacing.gutter }]}>
          {/* Eases up a little and settles, no bounce: a springy zoom on a question felt jarring. */}
          <Animated.View
            entering={sheetIn(reduceMotion)}
            style={{ alignSelf: 'stretch' }}
          >
            {/* The diary's cassette, set down on the page's top edge, half over it. */}
            <View style={{ alignItems: 'center', marginBottom: -stamp * 0.3, zIndex: 2 }}>
              <Buddy mood={mood === 'peek' ? 'happy' : mood} size={stamp} entrance={false} />
            </View>
            <Panel seed="confirm" style={{ paddingTop: stamp * 0.4 }}>
              <Text style={[typography.heading, { color: colors.ink, textAlign: 'center', alignSelf: 'stretch' }]}>
                {title}
                {HAND_TAIL}
              </Text>
              <Text style={[typography.caption, { color: colors.inkMuted, marginTop: spacing.sm, textAlign: 'center', alignSelf: 'stretch' }]}>{message}</Text>
              <View style={[styles.row, { gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
                <PillButton label={cancelLabel} icon="heart-outline" grow onPress={onCancel} />
                {single ? null : <PillButton label={confirmLabel} icon={confirmIcon} tone="dark" grow onPress={onConfirm} />}
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
