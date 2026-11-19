import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { sheetIn, sheetOut } from '../components/transitions';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { PillButton } from '../components/Buttons';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { SlidingToggle } from '../components/Pickers';
import { PressableScale } from '../components/PressableScale';
import { ActionBar, PageHeader, usePageContentStyle, type BarAction } from '../components/Screen';
import { useStatusPill } from '../components/StatusPill';
import { Buddy } from '../components/scrapbook/Buddy';
import { Confetti } from '../components/scrapbook/Confetti';
import { PaperBackground } from '../components/scrapbook/PaperBackground';
import { ScrapObject } from '../components/scrapbook/ScrapObject';
import { ShredAway } from '../components/scrapbook/ShredAway';
import { VoiceStrip, useVoiceRecording, type VoiceDraft } from '../components/VoiceRecorder';
import { Sticker } from '../components/scrapbook/Sticker';
import { WashiTape } from '../components/scrapbook/WashiTape';
import { entriesRepository, newEntryId, resolvePhotoUri, resolveVoiceUri, type Entry, type PhotoChange, type VoiceChange } from '../data';
import { useVoicePlayback } from '../hooks/useVoicePlayback';
import { useToday } from '../hooks/useData';
import { formatDisplayDate, formatMonthDay, parseLocalDate, resurfaceDate } from '../lib/dates';
import { successHaptic } from '../lib/haptics';
import { lookForEntry, STICKERS, TAPE_PATTERNS, TICKET_MAX_CHARS, type ObjectType, type StickerKind, type TapePattern } from '../lib/seeded';
import { STYLE_PALETTES, paletteByName, useTheme, type YearPalette } from '../theme';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
const CELEBRATE_RATIO = 0.62;
/** The memory is what you write on, so it is drawn big. */
const PREVIEW_RATIO = 0.8;
/** The sticker / tape sheet takes at most this share of the screen's height. */
const SHEET_MAX = 0.42;
/** null = let the seed decide ("Surprise me"). */
type Choice<T> = T | null;

type Mode = 'note' | 'photo';
/** What the sheet above the buttons shows: the photo choices, or the sticker / tape options. */
type Part = 'photo' | 'sticker' | 'tape';

const MODES = [
  { value: 'note', label: 'Just words', icon: 'create-outline' },
  { value: 'photo', label: 'With a photo', icon: 'camera-outline' },
] as const;
const PARTS = [
  { value: 'sticker', label: 'Sticker', icon: 'star-outline' },
  { value: 'tape', label: 'Tape', icon: 'bandage-outline' },
] as const;

/**
 * Today's page. At the top, "Just words | With a photo"; under it the memory itself, live: it changes
 * with every letter typed and every pick. Tap its tape or its sticker (or the dashed spot where a
 * sticker could go) and every option for that part opens underneath, with its colors.
 */
export default function EntryScreen() {
  const theme = useTheme();
  const { colors, spacing, radii, sizes, typography } = theme;
  const pageContent = usePageContentStyle({ withNavBar: false, gap: false, thumbBar: true });
  const { width, height: winH } = useWindowDimensions();
  const today = useToday();
  const statusPill = useStatusPill();
  const reduceMotion = useReducedMotion();
  const palette = theme.year(parseLocalDate(today).year);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  const [loaded, setLoaded] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [mode, setMode] = useState<Mode>('note');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<PhotoChange>({ kind: 'keep' });
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  /** The photo put aside when switching to "Just words", so switching back brings it back. */
  const [setAside, setSetAside] = useState<{ uri: string; change: PhotoChange } | null>(null);
  const [developKey, setDevelopKey] = useState(0);
  const [sticker, setSticker] = useState<Choice<StickerKind | 'none'>>(null);
  const [tape, setTape] = useState<Choice<TapePattern>>(null);
  /** Style palette names; null = the year's color. */
  const [stickerColor, setStickerColor] = useState<string | null>(null);
  const [tapeColor, setTapeColor] = useState<string | null>(null);
  const [part, setPart] = useState<Part | null>(null);
  const [previewY, setPreviewY] = useState(0);
  // Known before saving, so the preview's "Surprise me" picks are exactly what gets saved.
  const [entryId, setEntryId] = useState(newEntryId);
  const [existingEntry, setExistingEntry] = useState<Entry | null>(null);
  const [saving, setSaving] = useState(false);
  const [celebrating, setCelebrating] = useState<Entry | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  /** Taking the voice note off asks first (only the voice goes; the words and photo stay). */
  const [askRemoveVoice, setAskRemoveVoice] = useState(false);
  const [shredding, setShredding] = useState<Entry | null>(null);
  const [voice, setVoice] = useState<VoiceChange>({ kind: 'keep' });
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  /** A photo with a voice note: the words are written on the polaroid's back, so it can be turned over. */
  const [onBack, setOnBack] = useState(false);
  const voicePlayer = useVoicePlayback(voiceDraft?.uri ?? null);
  const rec = useVoiceRecording((draft) => changeVoice(draft));

  useEffect(() => {
    entriesRepository.getByDate(today).then((existing) => {
      if (existing) {
        setIsEdit(true);
        setText(existing.text);
        setMode(existing.photoPath ? 'photo' : 'note');
        setPreviewUri(existing.photoPath ? resolvePhotoUri(existing.photoPath) : null);
        setSticker((existing.sticker as StickerKind | 'none' | null) ?? null);
        setTape((existing.tapePattern as TapePattern | null) ?? null);
        setStickerColor(existing.stickerColor);
        setTapeColor(existing.tapeColor);
        setEntryId(existing.id);
        setExistingEntry(existing);
        if (existing.voicePath) setVoiceDraft({ uri: resolveVoiceUri(existing.voicePath), wave: existing.voiceWave ?? [], ms: existing.voiceMs ?? 0 });
      }
      setLoaded(true);
    });
  }, [today]);

  async function pick(source: 'library' | 'camera') {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera is off', 'Allow camera access in Settings to take a photo.');
        return;
      }
    }
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS) : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    setPhoto({ kind: 'set', sourceUri: asset.uri });
    setPreviewUri(asset.uri);
    setSetAside(null);
    setMode('photo');
    setPart(null);
    setDevelopKey((k) => k + 1);
  }

  function changeMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    if (next === 'note' && previewUri) {
      setSetAside({ uri: previewUri, change: photo });
      setPhoto({ kind: 'remove' });
      setPreviewUri(null);
    } else if (next === 'photo' && setAside) {
      setPreviewUri(setAside.uri);
      setPhoto(setAside.change);
      setSetAside(null);
    }
  }

  function changeVoice(draft: VoiceDraft | null) {
    setVoiceDraft(draft);
    if (draft) setVoice({ kind: 'set', sourceUri: draft.uri, wave: draft.wave, ms: draft.ms });
    else setVoice(existingEntry?.voicePath ? { kind: 'remove' } : { kind: 'keep' });
    if (!draft) setOnBack(false);
  }

  function openPart(next: Part) {
    setPart(next);
    // The options open right under the memory: put the memory at the top so both are in view while picking.
    Keyboard.dismiss();
    if (previewY > 0) setTimeout(() => scroll.current?.scrollTo({ y: previewY - spacing.md, animated: !reduceMotion }), 60);
  }

  const canSave = loaded && !saving && (mode === 'photo' ? previewUri !== null : text.trim().length > 0 || voiceDraft !== null);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const saved = await entriesRepository.saveForDate({
        localDate: today,
        text,
        photo,
        voice,
        id: entryId,
        style: { sticker, tapePattern: tape, stickerColor, tapeColor, objectType: mode === 'note' ? noteType : null },
      });
      successHaptic();
      const message = `Saved for ${formatDisplayDate(resurfaceDate(today))}`;
      if (reduceMotion) {
        statusPill.show(message);
        router.back();
        return;
      }
      setCelebrating(saved);
      setTimeout(() => {
        statusPill.show(message);
        router.back();
      }, theme.motion.celebrationMs);
    } catch (error) {
      setSaving(false);
      Alert.alert("Couldn't save", error instanceof Error ? error.message : String(error));
    }
  }

  const pageW = width - spacing.gutter * 2;
  const stickerPick = paletteByName(stickerColor) ?? palette;
  const tapePick = paletteByName(tapeColor) ?? palette;

  // The memory as it will be saved. In photo mode without a photo yet, an empty polaroid to tap.
  const previewEntry: Entry = {
    id: entryId,
    localDate: today,
    text,
    photoPath: previewUri ? (existingEntry?.photoPath ?? 'preview') : null,
    createdAt: existingEntry?.createdAt ?? today,
    updatedAt: existingEntry?.updatedAt ?? today,
    objectType: existingEntry?.objectType ?? null,
    tapePattern: tape,
    sticker,
    stickerColor,
    tapeColor,
    voicePath: voiceDraft ? (existingEntry?.voicePath ?? 'preview') : null,
    voiceWave: voiceDraft?.wave ?? null,
    voiceMs: voiceDraft?.ms ?? null,
  };
  const seeded = lookForEntry(previewEntry, theme.scrap.maxTilt, theme.scrap.maxOffset);
  // The words are typed on the memory, so its kind of paper must not change mid-sentence (that would rebuild the text
  // box and drop the keyboard). A note's paper is picked once, from the seed, as if for a short note; it only turns
  // from a ticket into a torn note when the words outgrow a ticket. The paper you saw is the one saved.
  const shortType = lookForEntry({ ...previewEntry, text: 'a', objectType: null }, theme.scrap.maxTilt, theme.scrap.maxOffset).objectType;
  const noteType: ObjectType =
    existingEntry?.objectType === 'ticket' || existingEntry?.objectType === 'tornNote'
      ? existingEntry.objectType === 'ticket' && text.length > TICKET_MAX_CHARS
        ? 'tornNote'
        : existingEntry.objectType
      : shortType === 'ticket' && text.length <= TICKET_MAX_CHARS
        ? 'ticket'
        : 'tornNote';
  const previewLook = mode === 'photo' ? (previewUri ? seeded : { ...seeded, objectType: 'polaroid' as const }) : { ...seeded, objectType: noteType };
  const writing = mode === 'note' || previewUri !== null;

  // The page's buttons, at the foot where a thumb reaches them (One UI style): each opens what it is about right above them.
  const sheetAction = (key: Part, icon: BarAction['icon'], label: string): BarAction => ({
    key,
    icon,
    label,
    tint: palette.primary,
    active: key === 'photo' ? part === 'photo' : part === 'sticker' || part === 'tape',
    onPress: () => (part !== null && (key === 'photo') === (part === 'photo') ? setPart(null) : openPart(key)),
  });
  const actions: BarAction[] = [
    { key: 'close', icon: 'close', label: 'Close', onPress: () => router.back() },
    sheetAction('photo', 'camera-outline', 'Photo'),
    sheetAction('sticker', 'color-palette-outline', 'Style'),
    // Voice starts a recording (and stops it). Once there is a voice note, the strip above has Listen / Re-record / Remove.
    ...(voiceDraft && !rec.recording
      ? []
      : [
          {
            key: 'voice',
            icon: rec.recording ? ('stop' as const) : ('mic-outline' as const),
            label: rec.recording ? 'Stop' : 'Voice',
            tint: palette.primary,
            active: rec.recording,
            accessibilityLabel: rec.recording ? 'Stop recording' : 'Record a voice note',
            onPress: () => {
              setPart(null);
              void (rec.recording ? rec.stop() : rec.start());
            },
          },
        ]),
    { key: 'save', icon: 'checkmark', label: isEdit ? 'Update' : 'Save', primary: colors.green, disabled: !canSave || rec.recording, onPress: save },
  ];

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      {/* padding on both platforms: the page shrinks above the keyboard, so everything can be scrolled into view while typing. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            pageContent,
            // iOS shows this page as a sheet, below the status bar already. The parts of a page belong together, so a closer gap.
            { gap: spacing.xl },
            Platform.OS === 'ios' ? { paddingTop: spacing.xl } : null,
          ]}
        >
          {/* No peeking bunny: the bunny under the note keeps this page company. */}
          <PageHeader
            title="Today"
            count={formatMonthDay(today)}
            accent={palette.secondary}
            buddy={false}
          />

          <SlidingToggle<Mode> options={MODES} value={mode} onChange={changeMode} accent={palette.primary} />

          {/* The memory itself, live. */}
          <View onLayout={(e) => setPreviewY(e.nativeEvent.layout.y)} style={{ alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.md, gap: spacing.lg }}>
            <ScrapObject
              key={developKey}
              entry={previewEntry}
              look={previewLook}
              photoUri={previewUri}
              develop={developKey > 0}
              width={pageW * PREVIEW_RATIO}
              raster={false}
              flipped={onBack}
              voicePlayer={voicePlayer}
              editor={
                loaded && writing
                  ? {
                      value: text,
                      onChangeText: setText,
                      placeholder: 'A note, a quote, anything small…',
                      // A new note opens ready to write; once you have typed, a new paper (ticket → torn note) keeps the keyboard.
                      autoFocus: (!isEdit && mode === 'note' && !voiceDraft) || text.length > 0,
                      onFocus: () => setPart(null),
                      accessibilityLabel: mode === 'photo' ? 'Words on the polaroid' : "Today's note",
                    }
                  : undefined
              }
              // No photo yet: pick one. A photo with a voice note: turn it over to write on the back.
              onPress={mode === 'photo' && !previewUri ? () => pick('library') : previewUri && voiceDraft ? () => setOnBack((b) => !b) : undefined}
              onPressTape={() => openPart('tape')}
              onPressSticker={() => openPart('sticker')}
            />
            {/* The buddy keeps you company while you write: it hops with every keystroke and cheers for a photo. */}
            <View style={[styles.row, { alignItems: 'center', gap: spacing.sm, alignSelf: 'stretch' }]}>
              <Buddy mood={previewUri ? 'cheer' : text.trim() ? 'happy' : 'wave'} accent={palette.primary} size={sizes.buddySmall * 0.8} bump={`${text.length}-${developKey}`} />
              <Text style={[typography.small, { color: colors.onDeskMuted, flex: 1 }]}>
                {canSave
                  ? `Lovely. I'll bring this back on ${formatDisplayDate(resurfaceDate(today))}. Decorate it from the buttons below.`
                  : voiceDraft && mode === 'note'
                    ? 'Your voice is the picture. Write a few words on the strip if you like.'
                    : mode === 'photo'
                    ? previewUri
                      ? 'Write on the strip under the photo. Longer words go on the back: P.T.O!'
                      : 'Tap the polaroid (or Photo below) to pick a photo, then write on it.'
                    : 'Write right on the paper. Decorate it from the buttons below.'}
              </Text>
            </View>
          </View>
        </ScrollView>
        {/* Sticker and tape: every option for the part, with its colors, in a sheet just above the buttons, in view without scrolling. */}
        {part ? (
          <Animated.View
            entering={sheetIn(reduceMotion)}
            exiting={sheetOut(reduceMotion)}
            style={{ marginHorizontal: spacing.gutter, marginBottom: spacing.sm, maxHeight: winH * SHEET_MAX, backgroundColor: colors.panel, borderRadius: radii.panel, padding: spacing.md, gap: spacing.md, boxShadow: theme.shadow(undefined, 1) }}
          >
            {part === 'photo' ? (
              <View style={{ gap: spacing.md }}>
                <Text style={[typography.label, { color: colors.ink }]}>{previewUri ? 'Another photo?' : 'Add a photo'} </Text>
                <View style={[styles.row, { gap: spacing.md }]}>
                  <PillButton label="Library" icon="images-outline" grow onPress={() => pick('library')} />
                  <PillButton label="Camera" icon="camera-outline" grow onPress={() => pick('camera')} />
                </View>
                {/* With a voice note the waveform has the strip, so the words live on the back. */}
                {previewUri && voiceDraft ? (
                  <PillButton label={onBack ? 'Back to the photo' : 'Write on the back'} icon="sync-outline" color={palette.primary} onPress={() => setOnBack((b) => !b)} />
                ) : null}
              </View>
            ) : (
            <>
            <View style={[styles.row, { alignItems: 'center', gap: spacing.sm }]}>
              <View style={{ flex: 1 }}>
                <SlidingToggle<'sticker' | 'tape'> options={PARTS} value={part} onChange={(p) => setPart(p)} accent={palette.secondary} />
              </View>
            </View>
            <ScrollView key={part} contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xs }} showsVerticalScrollIndicator={false}>
                  {part === 'sticker' ? (
                    <>
                      <View style={[styles.grid, { gap: spacing.sm }]}>
                        <Chip selected={sticker === null} onPress={() => setSticker(null)} label="Surprise me">
                          <Ionicons name="sparkles" size={sizes.icon} color={palette.primary} />
                        </Chip>
                        <Chip selected={sticker === 'none'} onPress={() => setSticker('none')} label="No sticker">
                          <Ionicons name="close" size={sizes.icon} color={colors.inkMuted} />
                        </Chip>
                        {STICKERS.map((kind) => (
                          <Chip key={kind} selected={sticker === kind} onPress={() => setSticker(kind)} label={`${kind} sticker`}>
                            <Sticker kind={kind} size={sizes.stickerTray * 0.75} color={stickerPick.primary} color2={stickerPick.secondary} />
                          </Chip>
                        ))}
                      </View>
                      <ColorRow label="Sticker color" value={stickerColor} onChange={setStickerColor} year={palette} />
                    </>
                  ) : (
                    <>
                      <View style={[styles.grid, { gap: spacing.sm }]}>
                        <Chip selected={tape === null} onPress={() => setTape(null)} label="Surprise me">
                          <Ionicons name="sparkles" size={sizes.icon} color={palette.primary} />
                        </Chip>
                        {TAPE_PATTERNS.map((pattern) => (
                          <Chip key={pattern} selected={tape === pattern} onPress={() => setTape(pattern)} label={`${pattern} tape`}>
                            <WashiTape width={sizes.swatch} color={tapePick.primary} color2={tapePick.secondary} pattern={pattern} angle={-8} />
                          </Chip>
                        ))}
                      </View>
                      <ColorRow label="Tape color" value={tapeColor} onChange={setTapeColor} year={palette} />
                    </>
                  )}
            </ScrollView>
            </>
            )}
          </Animated.View>
        ) : null}
        {/* The page's buttons at the foot, where a thumb reaches them; they ride up with the keyboard. */}
        <VoiceStrip rec={rec} value={rec.recording ? null : voiceDraft} player={voicePlayer} onRemove={() => setAskRemoveVoice(true)} accent={palette.primary} />
        <ActionBar withNavBar={false} actions={actions} />
      </KeyboardAvoidingView>

      {celebrating ? <Celebration entry={celebrating} width={width * CELEBRATE_RATIO} colors={[palette.primary, palette.secondary, colors.amber, colors.paperWhite]} /> : null}
      <ConfirmSheet
        visible={askRemoveVoice}
        title="Take your voice off?"
        message={`Only the voice note goes; your words${previewUri ? ' and photo stay' : ' stay'}.${existingEntry?.voicePath ? " It's gone for good once you tap Update." : ''}`}
        confirmLabel="Remove it"
        confirmIcon="mic-off-outline"
        onConfirm={() => {
          setAskRemoveVoice(false);
          if (voicePlayer?.playing) voicePlayer.toggle();
          changeVoice(null);
        }}
        onCancel={() => setAskRemoveVoice(false)}
      />
      {existingEntry ? (
        <ConfirmSheet
          visible={askDelete}
          title="Let this one go?"
          message={`Bun will forget today's page${existingEntry.photoPath ? ', photo and all' : existingEntry.voicePath ? ', voice and all' : ''}. It leaves this phone now and your Drive backup at the next backup. There's no getting it back.`}
          confirmLabel="Shred it"
          confirmIcon="cut-outline"
          onConfirm={() => {
            setAskDelete(false);
            setShredding(existingEntry);
          }}
          onCancel={() => setAskDelete(false)}
        />
      ) : null}
      {shredding ? (
        <ShredAway
          entry={shredding}
          onDone={() => {
            entriesRepository
              .remove(shredding.id)
              .then(() => router.back())
              .catch((error: unknown) => {
                setShredding(null);
                Alert.alert("Couldn't delete", error instanceof Error ? error.message : String(error));
              });
          }}
        />
      ) : null}
    </View>
  );
}

/** Save celebration: the entry pops onto the page, tape flickers on, confetti in the year color. */
function Celebration({ entry, width, colors }: { entry: Entry; width: number; colors: string[] }) {
  const theme = useTheme();
  const pop = useSharedValue(0);
  const scrim = useSharedValue(0);
  useEffect(() => {
    scrim.set(withTiming(1, { duration: theme.motion.imageFadeMs }));
    pop.set(withSpring(1, theme.motion.pop));
  }, [pop, scrim, theme.motion.imageFadeMs, theme.motion.pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + 0.4 * pop.get() }], opacity: Math.min(1, pop.get() * 2) }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="auto">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }, scrimStyle]} />
      <Animated.View style={popStyle}>
        <ScrapObject entry={entry} width={width} numberOfLines={6} lift={2} tapeFlicker />
        <Buddy mood="cheer" accent={colors[0]} style={{ alignSelf: 'center', marginTop: theme.spacing.lg }} />
      </Animated.View>
      <Confetti colors={colors} burstKey={1} />
    </View>
  );
}

/** A row of color swatches: the year's own color ("auto") first, then every style color. */
function ColorRow({
  label,
  value,
  onChange,
  year,
}: {
  label: string;
  value: string | null;
  onChange: (name: string | null) => void;
  year: YearPalette;
}) {
  const theme = useTheme();
  const { colors, spacing, sizes, typography } = theme;
  const swatch = (key: string, palette: YearPalette, selected: boolean, onPress: () => void, a11y: string, auto = false) => (
    <PressableScale key={key} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={a11y}>
      <View
        style={[
          styles.center,
          {
            width: sizes.swatch,
            height: sizes.swatch,
            borderRadius: sizes.swatch / 2,
            borderWidth: 3,
            borderColor: selected ? colors.ink : colors.paperWhite,
            backgroundColor: palette.primary,
            overflow: 'hidden',
            boxShadow: theme.shadow(palette.ink, selected ? 1 : 0.5),
            transform: [{ scale: selected ? 1.1 : 1 }],
          },
        ]}
      >
        {/* The partner color fills the lower half, as on the tape and stickers. */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: sizes.swatch / 2, backgroundColor: palette.secondary }} />
        {auto ? <Ionicons name="sparkles" size={sizes.iconSmall} color={colors.paperWhite} /> : null}
      </View>
    </PressableScale>
  );
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.label, { color: colors.ink }]}>{label}</Text>
      <View style={[styles.grid, { gap: spacing.md, padding: spacing.xs }]}>
        {swatch('auto', year, value === null, () => onChange(null), `${label}: the year's color`, true)}
        {STYLE_PALETTES.map((p) => swatch(p.name, p, value === p.name, () => onChange(p.name), `${label}: ${p.name}`))}
      </View>
    </View>
  );
}

function Chip({ selected, onPress, label, children }: { selected: boolean; onPress: () => void; label: string; children: React.ReactNode }) {
  const theme = useTheme();
  const { colors, sizes, radii, spacing } = theme;
  const size = sizes.stickerTray + spacing.md;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label}>
      <View
        style={[
          styles.center,
          {
            width: size + spacing.lg,
            height: size,
            borderRadius: radii.card,
            backgroundColor: colors.paperWhite,
            borderWidth: 3,
            borderColor: selected ? colors.amber : colors.paperWhite,
            boxShadow: theme.shadow(undefined, selected ? 1.2 : 0.6),
            transform: [{ rotate: selected ? '-3deg' : '0deg' }],
          },
        ]}
      >
        {children}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
