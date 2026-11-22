import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { PageFooter, PageHeader, usePageContentStyle, type BarAction } from '../../components/Screen';
import { BuddySays } from '../../components/scrapbook/Buddy';
import { DropIn } from '../../components/scrapbook/DropIn';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { MemoryCard } from '../../components/scrapbook/MemoryCard';
import { WritableText } from '../../components/scrapbook/WritableText';
import { Texture } from '../../components/scrapbook/Texture';
import { DiaryDock } from '../../components/DiaryDock';
import { ShredAway } from '../../components/scrapbook/ShredAway';
import { LiftedCassette, TapeRecorder, useCassetteLift } from '../../components/scrapbook/TapeRecorder';
import { entriesRepository, resolveVoiceUri, type Entry } from '../../data';
import { useTapeDeck } from '../../hooks/useTapeDeck';
import { useVoicePlayback } from '../../hooks/useVoicePlayback';
import { useAfterTransition } from '../../hooks/useAfterTransition';
import { arriveHaptic, rejectHaptic, successHaptic } from '../../lib/haptics';
import { useEntry, useToday } from '../../hooks/useData';
import { formatDisplayDate, formatMonthDay, memoryKicker, parseLocalDate, toLocalDate } from '../../lib/dates';
import { useTheme } from '../../theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** First-screen fit: the header's height, the page's bar, the deck row, the prompt lines, and a polaroid's height for its width. */
const HEADER_H = 150;
const BAR_H = 90;
const DECK_H = 76;
const PROMPT_H = 52;
const CARD_RATIO = 1.28;
const MIN_CARD_W = 200;
/** The lifted cassette is built this long after the memory has arrived. */
const LIFT_BUILD_AFTER_MS = 600;

export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { colors, spacing, typography } = theme;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const today = useToday();
  const { data: entry } = useEntry(id);
  const pageContent = usePageContentStyle({ thumbBar: true });

  const palette = theme.year(parseLocalDate(entry?.localDate ?? today).year);
  const kicker = entry ? memoryKicker(entry.localDate, today) : '';
  const savedOn = entry ? formatDisplayDate(toLocalDate(new Date(entry.createdAt))) : '';

  const [asking, setAsking] = useState(false);
  const [labeling, setLabeling] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const [savingLabel, setSavingLabel] = useState(false);
  const voiceTitle = entry?.voiceTitle || 'A little of me';
  const saveLabel = async () => {
    if (!entry || savingLabel) return;
    setSavingLabel(true);
    try {
      await entriesRepository.labelVoice(entry.id, labelDraft);
      setLabeling(false);
      successHaptic();
    } catch (error) {
      Alert.alert("Couldn't save the label", error instanceof Error ? error.message : String(error));
    } finally {
      setSavingLabel(false);
    }
  };
  const hasVoice = entry?.voicePath != null;
  const hasPage = entry != null && (entry.text.trim().length > 0 || entry.photoPath != null);
  // Everything you'd reach for sits on the first screen: the memory is sized so that its tape deck, "what would you
  // tell yourself now?" and when it was sealed all fit under it, above the page's buttons.
  const below = (hasVoice ? DECK_H : 0) + PROMPT_H + spacing.xl * 2;
  const cardW = Math.max(MIN_CARD_W, Math.min(width - 56, (height - insets.top - HEADER_H - BAR_H - insets.bottom - below) / CARD_RATIO));
  const [back, setBack] = useState(false);
  const turnCard = useCallback(() => setBack((b) => !b), []);
  // The page slides in light (paper, title, buttons); the memory itself (photo decode, polaroid, audio player) is built
  // once it has arrived, then drops in. Building it mid-slide cost a frame of over a second.
  const arrived = useAfterTransition(theme.motion.screenFallbackMs);
  // A soft tick as the page settles into place, the way a card clicks onto the desk.
  useEffect(() => {
    if (arrived) arriveHaptic();
  }, [arrived]);
  const voicePlayer = useVoicePlayback(arrived && entry?.voicePath ? resolveVoiceUri(entry.voicePath) : null);
  const deck = useTapeDeck(voicePlayer);
  const cassetteLift = useCassetteLift(deck);
  // The big cassette is built a moment after the page has settled (not in the same frame as the memory), or at once if
  // it is picked up before then.
  const [liftReady, setLiftReady] = useState(false);
  useEffect(() => {
    if (!arrived || liftReady) return;
    const timer = setTimeout(() => setLiftReady(true), LIFT_BUILD_AFTER_MS);
    return () => clearTimeout(timer);
  }, [arrived, liftReady]);
  // Writing back to your past self: any page from before today can be answered, right on the page, in sepia.
  const canWriteBack = entry != null && entry.localDate < today;
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState('');
  const [sealing, setSealing] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const startWriting = () => {
    setLabeling(false);
    setDraft(entry?.reply ?? '');
    setWriting(true);
  };
  // Bring the reply into view above the keyboard once it is there.
  useEffect(() => {
    if (!writing && !labeling) return;
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 350);
    return () => clearTimeout(t);
  }, [writing, labeling]);
  const seal = () => {
    if (!entry || sealing) return;
    setSealing(true);
    entriesRepository
      .writeBack(entry.id, draft)
      .then(() => {
        successHaptic();
        setWriting(false);
      })
      .catch((error: unknown) => Alert.alert("Couldn't save your reply", error instanceof Error ? error.message : String(error)))
      .finally(() => setSealing(false));
  };

  // The memory being shredded: kept here so the animation can show it while it is deleted underneath.
  const [shredding, setShredding] = useState<Entry | null>(null);

  const shred = () => {
    if (!entry) return;
    setAsking(false);
    rejectHaptic();
    setShredding(entry);
  };
  const afterShred = () => {
    const gone = shredding;
    if (!gone) return;
    entriesRepository
      .remove(gone.id)
      .then(() => router.back())
      .catch((error: unknown) => {
        setShredding(null);
        Alert.alert("Couldn't delete", error instanceof Error ? error.message : String(error));
      });
  };

  const actions: BarAction[] = writing
    ? [
        { key: 'cancel', icon: 'close', label: 'Cancel', onPress: () => setWriting(false) },
        { key: 'seal', icon: 'checkmark', label: entry?.reply && draft.trim().length === 0 ? 'Remove' : 'Seal it', primary: colors.primary, disabled: sealing, onPress: seal },
      ]
    : [{ key: 'back', icon: 'chevron-back', label: 'Back', onPress: () => router.back() }];
  if (!writing && entry && hasPage) actions.push({ key: 'turn', icon: 'sync-outline', label: back ? 'Front' : 'Turn', accessibilityLabel: back ? 'Turn to the front of the memory' : 'Turn over and read the back', onPress: turnCard });
  if (!writing && canWriteBack) {
    actions.push({ key: 'reply', icon: 'create-outline', label: 'Reply', tint: colors.giltBright, accessibilityLabel: entry?.reply ? 'Change your reply to your past self' : 'Write back to your past self', onPress: startWriting });
  }
  if (!writing && entry) actions.push({ key: 'give', icon: 'gift-outline', label: 'Give', accessibilityLabel: 'Give this page to someone', onPress: () => router.push({ pathname: '/letters', params: { entryId: entry.id } }) });
  if (!writing && entry) actions.push({ key: 'delete', icon: 'trash-outline', label: 'Delete', accessibilityLabel: 'Delete this memory', onPress: () => setAsking(true) });
  const replyEditor = writing
    ? { value: draft, onChangeText: setDraft, placeholder: 'How does this feel now? What would you tell yourself that day?', autoFocus: true, accessibilityLabel: 'Your reply to your past self' }
    : undefined;

  return (
    // padding: the page shrinks above the keyboard while you write back, and the bar rides up with it.
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <PaperBackground variant="dots" desk />
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={[pageContent, { paddingBottom: spacing.xl }]} keyboardShouldPersistTaps="handled">
        {/* The date is the title (it always fits one line); how long ago it was goes under it. */}
        <PageHeader
          title={entry ? formatMonthDay(entry.localDate) : 'A memory'}
          subtitle={entry ? `${kicker} · ${parseLocalDate(entry.localDate).year}` : undefined}
          accent={palette.secondary}
          buddyAccent={palette.primary}
          buddy={false}
        />
        {entry === null ? (
          <BuddySays mood="sleepy" accent={palette.primary} text="This memory isn't here anymore." />
        ) : entry ? (
          <>
            <DropIn ready={arrived} index={0} style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.xl }}>
              {arrived && hasPage ? <MemoryCard key={entry.id} entry={entry} width={cardW} back={back} onTurn={turnCard} /> : null}
              {/* The voice, on the page under the memory (not over the page's words). */}
              {!writing && arrived && hasVoice && voicePlayer ? <TapeRecorder width={width - spacing.gutter * 2} player={voicePlayer} label={voiceTitle} deck={deck} lift={cassetteLift} /> : null}
              {hasVoice && !writing ? (
                <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
                  {labeling ? (
                    <View style={{ backgroundColor: colors.paper, padding: spacing.lg, gap: spacing.sm, boxShadow: theme.shadow() }}>
                      <Text style={[typography.caption, { color: colors.inkMuted }]}>A few words for the cassette</Text>
                      <TextInput value={labelDraft} onChangeText={setLabelDraft} maxLength={60} autoFocus editable={!savingLabel} placeholder="e.g. The walk home" placeholderTextColor={colors.inkMuted} accessibilityLabel="Cassette label" style={[typography.hand, { color: colors.inkBlue, minHeight: 48 }]} />
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg }}>
                        <Pressable disabled={savingLabel} onPress={() => setLabeling(false)} accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[typography.label, { color: colors.inkMuted }]}>Cancel</Text></Pressable>
                        <Pressable disabled={savingLabel} onPress={() => void saveLabel()} accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[typography.label, { color: colors.ink }]}>{savingLabel ? 'Keeping…' : 'Keep label'}</Text></Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable onPress={() => { setLabelDraft(entry.voiceTitle ?? ''); setLabeling(true); }} accessibilityRole="button" accessibilityLabel="Write a label for this cassette" style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={[typography.caption, { color: colors.onDesk }]}>{entry.voiceTitle ? 'Rewrite the cassette label' : 'Write a few words on the cassette'} </Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
              {entry.reply || writing ? (
                <View style={{ alignSelf: 'stretch', backgroundColor: colors.paper, padding: 20, gap: 10, transform: [{ rotate: '-1deg' }], boxShadow: theme.shadow() }}>
                  <Texture kind="paper" opacity={0.7} />
                  <Text style={[typography.caption, { color: colors.sepia }]}>a note beside this memory</Text>
                  <WritableText text={entry.reply ?? ''} editor={replyEditor} style={[typography.hand, { color: colors.sepia }]} />
                  {!writing && entry.repliedAt ? <Text style={[typography.caption, { color: colors.inkMuted }]}>written back on {formatDisplayDate(toLocalDate(new Date(entry.repliedAt)))}</Text> : null}
                </View>
              ) : null}
            </DropIn>
            {/* Full width + right-aligned: a shrink-wrapped Caveat label gets under-measured on Android and loses its last word. */}
            {/* Right under it: an answer to write, and when it was sealed. */}
            <View style={{ alignItems: 'center', gap: 2, marginTop: -spacing.lg }}>
              {canWriteBack && !entry.reply && !writing ? (
                <Pressable onPress={startWriting} accessibilityRole="button" accessibilityLabel="Write back to your past self" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1, borderBottomColor: colors.onDeskMuted, paddingBottom: 1 }}>
                  <Ionicons name="pencil" size={15} color={colors.onDesk} />
                  <Text style={[typography.caption, { color: colors.onDesk, paddingRight: 0 }]}>Leave a note beside this. </Text>
                </Pressable>
              ) : null}
              <Text style={[typography.caption, { color: colors.onDeskMuted, fontSize: 14, alignSelf: 'stretch', textAlign: 'center' }]}>sealed on {savedOn} </Text>
            </View>
            <PageFooter label={`a page from ${parseLocalDate(entry.localDate).year}`} />
          </>
        ) : null}
      </ScrollView>
      {/* The page's buttons at the foot, in reach of a thumb. Today's page is edited from the bar's + (it turns into a pencil), so no Edit here. */}
      <DiaryDock actions={actions} />
      {/* The voice's cassette, lifted up over the page when it plays (built once the memory has arrived). */}
      {!writing && arrived && hasVoice && voicePlayer && entry && (liftReady || cassetteLift.held) ? <LiftedCassette lift={cassetteLift} label={voiceTitle} player={voicePlayer} deck={deck} /> : null}
      {entry ? (
        <ConfirmSheet
          visible={asking}
          title="Tear out this page?"
          message={`The page from ${formatDisplayDate(entry.localDate)}${entry.photoPath ? ', photo and all' : entry.voicePath ? ', voice and all' : ''} leaves this phone now, and your Drive backup at the next backup. There's no getting it back.`}
          confirmLabel="Tear it out"
          confirmIcon="trash-outline"
          onConfirm={shred}
          onCancel={() => setAsking(false)}
        />
      ) : null}
      {/* Then you tear it out yourself: pull the strip down the middle of the page (Keep it backs out). */}
      {shredding ? <ShredAway entry={shredding} onDone={afterShred} onCancel={() => setShredding(null)} /> : null}
    </KeyboardAvoidingView>
  );
}
