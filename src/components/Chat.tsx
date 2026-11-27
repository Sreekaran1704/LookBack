import Ionicons from '@expo/vector-icons/Ionicons';
import { makeImageFromView, ImageFormat } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import type { VoiceDraft } from './VoiceRecorder';
import { REACTIONS, TEXT_MAX } from '../lib/chat';
import { useVoicePlayback } from '../hooks/useVoicePlayback';
import { mixHex, useTheme, withAlpha } from '../theme';
import { PillButton } from './Buttons';
import { PressableScale } from './PressableScale';
import { Waveform } from './scrapbook/Waveform';
import { sheetIn } from './transitions';
import { useVoiceRecording } from './VoiceRecorder';

/**
 * The chat's pieces for the person page (lib/chat.ts holds the rules): the message box with its voice button, a voice
 * message's player, the reactions under a bubble, the reaction bar that opens on a long press, and the sheet that
 * quotes picked lines into today's page. Paper stays light, so words on it are ink.
 */

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

/** Type a message (or hold nothing and tap the mic to record a voice message; tap again to send it). */
export function Composer({ onSendText, onSendVoice, disabled }: { onSendText: (text: string) => void; onSendVoice: (v: VoiceDraft) => void; disabled?: boolean }) {
  const theme = useTheme();
  const { colors, spacing, typography, control } = theme;
  const [text, setText] = useState('');
  const rec = useVoiceRecording(onSendVoice);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSendText(t);
    setText('');
  };
  return (
    <View style={[styles.row, { gap: spacing.sm, marginHorizontal: spacing.gutter, marginBottom: spacing.sm, padding: spacing.xs, borderRadius: control.radius * 1.5, backgroundColor: colors.panel, boxShadow: theme.shadow(undefined, 1.4) }]}>
      {rec.recording ? (
        <View style={[styles.row, { flex: 1, gap: spacing.sm, paddingHorizontal: spacing.sm, minHeight: 44 }]}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.wax }} />
          <Text style={[typography.print, { color: colors.ink, flex: 1 }]}>{`Recording… ${fmt(rec.elapsed)}  · tap to send`}</Text>
        </View>
      ) : (
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write to them…"
          placeholderTextColor={colors.inkMuted}
          multiline
          maxLength={TEXT_MAX}
          editable={!disabled}
          style={[typography.hand, { flex: 1, color: colors.ink, maxHeight: 120, paddingHorizontal: spacing.sm, paddingVertical: 6, fontSize: 19, lineHeight: 24 }]}
          accessibilityLabel="Message"
        />
      )}
      {text.trim() && !rec.recording ? (
        <RoundButton icon="send" label="Send" onPress={send} filled disabled={disabled} />
      ) : (
        <RoundButton icon={rec.recording ? 'stop' : 'mic-outline'} label={rec.recording ? 'Stop and send' : 'Record a voice message'} onPress={() => void (rec.recording ? rec.stop() : rec.start())} filled={rec.recording} disabled={disabled} />
      )}
    </View>
  );
}

function RoundButton({ icon, label, onPress, filled, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; filled?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? colors.ink : withAlpha(colors.ink, 0.07) }}>
        <Ionicons name={icon} size={20} color={filled ? colors.panel : colors.ink} />
      </View>
    </PressableScale>
  );
}

/** A voice message: play / pause, its waveform filling as it plays, and its length. */
export function VoiceBubble({ uri, wave, ms }: { uri: string | null; wave: number[] | null; ms: number | null }) {
  const { colors, typography, spacing } = useTheme();
  const player = useVoicePlayback(uri);
  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      <PressableScale onPress={() => player?.toggle()} accessibilityRole="button" accessibilityLabel={player?.playing ? 'Pause' : 'Play the voice message'}>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }}>
          <Ionicons name={player?.playing ? 'pause' : 'play'} size={18} color={colors.panel} />
        </View>
      </PressableScale>
      <Waveform wave={wave} width={150} height={30} color={colors.inkBlue} progress={player?.progress} playing={player?.playing} heart={false} />
      <Text style={[typography.caption, { color: colors.inkMuted, fontSize: 13 }]}>{fmt(ms ?? 0)}</Text>
    </View>
  );
}

/** The reactions on a bubble, as little chips (yours outlined in gilt; tap yours to take it away). */
export function ReactionChips({ reactions, mine, onRemoveMine }: { reactions: readonly { emoji: string; from: string }[]; mine: boolean; onRemoveMine?: () => void }) {
  const { colors } = useTheme();
  if (!reactions.length) return null;
  return (
    <View style={[styles.row, { gap: 4, alignSelf: mine ? 'flex-end' : 'flex-start', marginTop: -8, marginHorizontal: 10 }]}>
      {reactions.map((r) => {
        const chip = (
          <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 12, backgroundColor: colors.panel, borderWidth: 1, borderColor: r.from === 'me' ? colors.gilt : withAlpha(colors.ink, 0.15) }}>
            <Text style={{ fontSize: 15 }}>{r.emoji}</Text>
          </View>
        );
        return r.from === 'me' && onRemoveMine ? (
          <PressableScale key={`${r.from}${r.emoji}`} onPress={onRemoveMine} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Take back your ${r.emoji}`}>
            {chip}
          </PressableScale>
        ) : (
          <View key={`${r.from}${r.emoji}`}>{chip}</View>
        );
      })}
    </View>
  );
}

/**
 * The reaction bar (one tap on a message: tap a reaction, tap yours again to take it away) and the long-press options:
 * "Add to today's memory" (pick bubbles; a picture of them goes on today's page), Delete for me, and Delete for
 * everyone (your own message, only until they've seen it). Either part can be left out.
 */
export function MessageMenu({
  visible,
  current,
  onReact,
  onSelect,
  onDeleteMe,
  onDeleteAll,
  onClose,
}: {
  visible: boolean;
  current: string | null;
  onReact: ((emoji: string) => void) | null;
  onSelect: (() => void) | null;
  onDeleteMe: (() => void) | null;
  onDeleteAll: (() => void) | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const reduceMotion = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.paper.darkDeep, 0.35) }]} />
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', padding: spacing.gutter }]}>
        <Animated.View entering={sheetIn(reduceMotion)} style={{ gap: spacing.sm, alignItems: 'stretch', minWidth: 280 }}>
          {onReact ? (
            <View style={[styles.row, { gap: 4, padding: spacing.sm, borderRadius: 30, backgroundColor: colors.panel, boxShadow: theme.shadow(undefined, 2), justifyContent: 'center' }]}>
              {REACTIONS.map((e) => (
                <PressableScale key={e} onPress={() => onReact(current === e ? '' : e)} accessibilityRole="button" accessibilityLabel={current === e ? `Take back ${e}` : `React ${e}`}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: current === e ? withAlpha(colors.gilt, 0.35) : 'transparent' }}>
                    <Text style={{ fontSize: 28 }}>{e}</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          ) : null}
          {onSelect || onDeleteMe || onDeleteAll ? (
            <View style={{ borderRadius: 14, backgroundColor: colors.panel, boxShadow: theme.shadow(undefined, 2), overflow: 'hidden' }}>
              {onSelect ? <MenuRow icon="bookmark-outline" label="Add to today's memory" onPress={onSelect} /> : null}
              {onDeleteMe ? <MenuRow icon="trash-outline" label="Delete for me" onPress={onDeleteMe} /> : null}
              {onDeleteAll ? <MenuRow icon="trash" label="Delete for everyone" onPress={onDeleteAll} danger /> : null}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

function MenuRow({ icon, label, onPress, danger }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; danger?: boolean }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 52, backgroundColor: pressed ? withAlpha(colors.ink, 0.06) : 'transparent', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: withAlpha(colors.ink, 0.12) }]}>
      <Ionicons name={icon} size={20} color={danger ? colors.wax : colors.ink} />
      <Text style={[typography.print, { color: danger ? colors.wax : colors.ink, flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

/** One bubble in a quoted picture. */
export interface SnippetBubble {
  key: string;
  mine: boolean;
  who: string;
  text: string | null;
  voiceMs: number | null;
  voiceWave: number[] | null;
  page: { date: string; line: string; photo: string | null } | null;
  time: string;
}

/**
 * The picked bubbles, as they'd look in a screenshot of the chat (just those, nothing else): a little paper card with
 * the two names and the bubbles in order, theirs left and yours right. "Add to today's page" turns it into a picture
 * on today's page (it replaces a photo that's already there, after asking).
 */
export function SnippetSheet({ visible, title, bubbles, onAdd, onClose }: { visible: boolean; title: string; bubbles: readonly SnippetBubble[]; onAdd: (base64: string) => void; onClose: () => void }) {
  const theme = useTheme();
  const { colors, spacing, typography } = theme;
  const reduceMotion = useReducedMotion();
  const card = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);
  const snap = async () => {
    if (!card.current || busy) return;
    setBusy(true);
    try {
      // Skia reads the card's native view (its ref types predate React Native's newer element refs).
      const image = await makeImageFromView(card as never);
      const b64 = image?.encodeToBase64(ImageFormat.JPEG, 92);
      if (b64) onAdd(b64);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.paper.darkDeep, 0.6) }]} />
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'center', padding: spacing.gutter, gap: spacing.md }]}>
        <Animated.View entering={sheetIn(reduceMotion)} style={{ gap: spacing.md }}>
          {/* This card is what becomes the picture. */}
          <View ref={card} collapsable={false} style={{ padding: spacing.md, gap: spacing.sm, borderRadius: 12, backgroundColor: colors.paper }}>
            <Text style={[typography.stamp, { color: colors.gilt, textAlign: 'center', alignSelf: 'stretch' }]}>{title}</Text>
            {bubbles.map((b) => (
              <View key={b.key} style={{ maxWidth: '84%', alignSelf: b.mine ? 'flex-end' : 'flex-start' }}>
                <View style={{ padding: spacing.sm, borderRadius: 14, borderBottomLeftRadius: b.mine ? 14 : 4, borderBottomRightRadius: b.mine ? 4 : 14, backgroundColor: b.mine ? mixHex(colors.panel, colors.gilt, 0.32) : colors.panel, borderWidth: 1, borderColor: b.mine ? withAlpha(colors.gilt, 0.55) : withAlpha(colors.ink, 0.12) }}>
                  {b.page ? (
                    <View style={[styles.row, { gap: spacing.sm }]}>
                      {b.page.photo ? <Image source={{ uri: b.page.photo }} style={{ width: 52, height: 52, borderRadius: 6 }} contentFit="cover" /> : <Ionicons name="document-text-outline" size={22} color={colors.inkMuted} />}
                      <View style={{ flexShrink: 1 }}>
                        <Text style={[typography.print, { color: colors.ink }]}>{b.page.date}</Text>
                        <Text numberOfLines={3} style={[typography.hand, { color: colors.inkBlue, fontSize: 17, lineHeight: 21 }]}>{b.page.line}</Text>
                      </View>
                    </View>
                  ) : b.text !== null ? (
                    <Text style={[typography.hand, { color: colors.ink, fontSize: 18, lineHeight: 23 }]}>{b.text}</Text>
                  ) : (
                    <View style={[styles.row, { gap: spacing.sm }]}>
                      <Ionicons name="play" size={16} color={colors.ink} />
                      <Waveform wave={b.voiceWave} width={120} height={24} color={colors.inkBlue} heart={false} />
                      <Text style={[typography.caption, { color: colors.inkMuted, fontSize: 12 }]}>{fmt(b.voiceMs ?? 0)}</Text>
                    </View>
                  )}
                </View>
                <Text style={[typography.caption, { color: colors.inkMuted, fontSize: 11, lineHeight: 14, textAlign: b.mine ? 'right' : 'left', alignSelf: 'stretch' }]}>{`${b.who} · ${b.time}`}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.row, { gap: spacing.md }]}>
            <PillButton label="Keep it" grow onPress={onClose} />
            <PillButton label={busy ? 'Saving…' : "Add to today's memory"} icon="bookmark-outline" tone="dark" grow disabled={busy} onPress={() => void snap()} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
