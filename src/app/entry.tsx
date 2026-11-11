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
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { CircleButton, PillButton } from '../components/Buttons';
import { SlidingToggle } from '../components/Pickers';
import { PressableScale } from '../components/PressableScale';
import { ScreenTitle, TopBar } from '../components/Screen';
import { useStatusPill } from '../components/StatusPill';
import { Buddy } from '../components/scrapbook/Buddy';
import { Confetti } from '../components/scrapbook/Confetti';
import { PaperBackground } from '../components/scrapbook/PaperBackground';
import { ScrapObject } from '../components/scrapbook/ScrapObject';
import { Sticker } from '../components/scrapbook/Sticker';
import { WashiTape } from '../components/scrapbook/WashiTape';
import { entriesRepository, newEntryId, resolvePhotoUri, type Entry, type PhotoChange } from '../data';
import { useToday } from '../hooks/useData';
import { formatDisplayDate, formatMonthDay, parseLocalDate, resurfaceDate } from '../lib/dates';
import { successHaptic } from '../lib/haptics';
import { lookForEntry, STICKERS, TAPE_PATTERNS, type StickerKind, type TapePattern } from '../lib/seeded';
import { STYLE_PALETTES, paletteByName, useTheme, type YearPalette } from '../theme';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
/** Ruled lines under a photo, for a short caption. */
const CAPTION_LINES = 3;
const CELEBRATE_RATIO = 0.62;
const PREVIEW_RATIO = 0.6;
/** null = let the seed decide ("Surprise me"). */
type Choice<T> = T | null;

type Mode = 'note' | 'photo';
type Part = 'sticker' | 'tape';

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
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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

  function openPart(next: Part) {
    setPart((p) => (p === next ? null : next));
    // The options open right under the memory: put the memory at the top so both are in view while picking.
    Keyboard.dismiss();
    if (previewY > 0) setTimeout(() => scroll.current?.scrollTo({ y: previewY - spacing.md, animated: !reduceMotion }), 60);
  }

  const canSave = loaded && !saving && (mode === 'photo' ? previewUri !== null : text.trim().length > 0);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const saved = await entriesRepository.saveForDate({
        localDate: today,
        text,
        photo,
        id: entryId,
        style: { sticker, tapePattern: tape, stickerColor, tapeColor },
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
  const lineGap = sizes.ruledLineGap;
  const lines = mode === 'photo' ? CAPTION_LINES : sizes.inputMinLines;
  const inputHeight = lineGap * lines;

  // The memory as it will be saved. In photo mode without a photo yet, an empty polaroid to tap.
  const previewEntry: Entry = {
    id: entryId,
    localDate: today,
    text: text.trim() || (mode === 'photo' ? '' : 'Your moment goes here…'),
    photoPath: previewUri ? (existingEntry?.photoPath ?? 'preview') : null,
    createdAt: existingEntry?.createdAt ?? today,
    updatedAt: existingEntry?.updatedAt ?? today,
    objectType: existingEntry?.objectType ?? null,
    tapePattern: tape,
    sticker,
    stickerColor,
    tapeColor,
  };
  const seeded = lookForEntry(previewEntry, theme.scrap.maxTilt, theme.scrap.maxOffset);
  const previewLook = mode === 'photo' && !previewUri ? { ...seeded, objectType: 'polaroid' as const } : seeded;

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      {/* padding on both platforms: the page shrinks above the keyboard, so everything can be scrolled into view while typing. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingTop: Platform.OS === 'ios' ? spacing.xl : insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.xxxl * 2,
            paddingHorizontal: spacing.gutter,
            gap: spacing.xl,
          }}
        >
          <TopBar
            left={<CircleButton icon="close" accessibilityLabel="Close" onPress={() => router.back()} />}
            right={<PillButton label={isEdit ? 'Update' : 'Stick it in'} icon="checkmark" tone="green" onPress={save} disabled={!canSave} />}
          />
          <ScreenTitle title="Today" count={formatMonthDay(today)} accent={palette.secondary} />

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
              numberOfLines={6}
              raster={false}
              onPress={mode === 'photo' && !previewUri ? () => pick('library') : undefined}
              onPressTape={() => openPart('tape')}
              onPressSticker={() => openPart('sticker')}
            />
            {/* The buddy keeps you company while you write: it hops with every keystroke and cheers for a photo. */}
            <View style={[styles.row, { alignItems: 'center', gap: spacing.sm, alignSelf: 'stretch' }]}>
              <Buddy mood={previewUri ? 'cheer' : text.trim() ? 'happy' : 'wave'} accent={palette.primary} size={sizes.buddySmall * 0.8} bump={`${text.length}-${developKey}`} />
              <Text style={[typography.small, { color: colors.onDeskMuted, flex: 1 }]}>
                {canSave
                  ? `Lovely. I'll bring this back on ${formatDisplayDate(resurfaceDate(today))}. Tap the tape or sticker to change them.`
                  : mode === 'photo'
                    ? 'Tap the polaroid to pick a photo, then write a note to stick on it.'
                    : 'Write below and watch it appear. Tap the tape or sticker to change them.'}
              </Text>
            </View>
          </View>

          {mode === 'photo' ? (
            <View style={[styles.row, { gap: spacing.md, flexWrap: 'wrap', justifyContent: 'center' }]}>
              <PillButton label={previewUri ? 'Another photo' : 'Library'} icon="images-outline" onPress={() => pick('library')} />
              <PillButton label="Camera" icon="camera-outline" onPress={() => pick('camera')} />
            </View>
          ) : null}

          {/* Note card with ruled lines, right under the memory so both are in view while writing.
              With a photo, what's written here is the note stuck to the photo. */}
          <View
            style={{
              backgroundColor: colors.paperWhite,
              borderRadius: radii.paper,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.sm,
              boxShadow: theme.shadow(palette.primary, 1),
              transform: [{ rotate: '-0.8deg' }],
            }}
          >
            <Svg pointerEvents="none" width={pageW} height={inputHeight + spacing.sm} style={StyleSheet.absoluteFill}>
              {Array.from({ length: lines }, (_, i) => {
                const y = spacing.sm + lineGap * (i + 1) - spacing.xs;
                return <Line key={i} x1={0} x2={pageW} y1={y} y2={y} stroke={colors.ruleLine} strokeWidth={1} />;
              })}
              <Line x1={spacing.xxl} x2={spacing.xxl} y1={0} y2={inputHeight + spacing.sm} stroke={colors.marginLine} strokeWidth={1} />
            </Svg>
            {loaded ? (
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={mode === 'photo' ? 'A little note to stick on the photo…' : 'A note, a quote, anything small…'}
                placeholderTextColor={colors.inkMuted}
                multiline
                autoFocus={!isEdit && mode === 'note'}
                textAlignVertical="top"
                onFocus={() => {
                  setPart(null);
                  // Keep the memory in view above the keyboard while writing.
                  if (previewY > 0) setTimeout(() => scroll.current?.scrollTo({ y: previewY, animated: !reduceMotion }), 250);
                }}
                style={[typography.body, { color: colors.ink, lineHeight: lineGap, minHeight: inputHeight, paddingLeft: spacing.xl, paddingTop: spacing.xs }]}
                accessibilityLabel={mode === 'photo' ? 'Note on the photo' : "Today's note"}
              />
            ) : (
              <View style={{ height: inputHeight }} />
            )}
          </View>

          {/* Every option for the tapped part, with its colors. */}
          <View style={{ gap: spacing.md }}>
            <SlidingToggle<Part | 'none'>
              options={PARTS}
              value={part ?? 'none'}
              onChange={(p) => openPart(p as Part)}
              accent={palette.secondary}
            />
            {part ? (
              <Animated.View
                key={part}
                entering={reduceMotion ? undefined : FadeInDown.springify().damping(18)}
                style={{ backgroundColor: colors.panel, borderRadius: radii.panel, padding: spacing.lg, gap: spacing.lg, boxShadow: theme.shadow(undefined, 1) }}
              >
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
              </Animated.View>
            ) : null}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {celebrating ? <Celebration entry={celebrating} width={width * CELEBRATE_RATIO} colors={[palette.primary, palette.secondary, colors.amber, colors.paperWhite]} /> : null}
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
