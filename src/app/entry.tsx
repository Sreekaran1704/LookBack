import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { CircleButton, PillButton } from '../components/Buttons';
import { PressableScale } from '../components/PressableScale';
import { ScreenTitle, TopBar } from '../components/Screen';
import { useStatusPill } from '../components/StatusPill';
import { Buddy, BuddySays } from '../components/scrapbook/Buddy';
import { Confetti } from '../components/scrapbook/Confetti';
import { PaperBackground } from '../components/scrapbook/PaperBackground';
import { Polaroid } from '../components/scrapbook/Polaroid';
import { ScrapObject } from '../components/scrapbook/ScrapObject';
import { Sticker } from '../components/scrapbook/Sticker';
import { WashiTape } from '../components/scrapbook/WashiTape';
import { entriesRepository, newEntryId, resolvePhotoUri, type Entry, type PhotoChange } from '../data';
import { useToday } from '../hooks/useData';
import { formatDisplayDate, formatMonthDay, parseLocalDate, resurfaceDate } from '../lib/dates';
import { successHaptic, tapHaptic } from '../lib/haptics';
import { STICKERS, TAPE_PATTERNS, type StickerKind, type TapePattern } from '../lib/seeded';
import { STYLE_PALETTES, paletteByName, useTheme, type YearPalette } from '../theme';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
const POLAROID_RATIO = 0.62;
const CELEBRATE_RATIO = 0.62;
const PREVIEW_RATIO = 0.6;
/** null = let the seed decide ("Surprise me"). */
type Choice<T> = T | null;

export default function EntryScreen() {
  const theme = useTheme();
  const { colors, spacing, radii, sizes, typography } = theme;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = useToday();
  const statusPill = useStatusPill();
  const reduceMotion = useReducedMotion();
  const palette = theme.year(parseLocalDate(today).year);

  const [loaded, setLoaded] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<PhotoChange>({ kind: 'keep' });
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [developKey, setDevelopKey] = useState(0);
  const [sticker, setSticker] = useState<Choice<StickerKind | 'none'>>(null);
  const [tape, setTape] = useState<Choice<TapePattern>>(null);
  /** Style palette names; null = the year's color. */
  const [stickerColor, setStickerColor] = useState<string | null>(null);
  const [tapeColor, setTapeColor] = useState<string | null>(null);
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
    setDevelopKey((k) => k + 1);
  }

  function removePhoto() {
    tapHaptic();
    setPhoto({ kind: 'remove' });
    setPreviewUri(null);
  }

  const canSave = loaded && !saving && (text.trim().length > 0 || previewUri !== null);

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
  const polaroidW = pageW * POLAROID_RATIO;
  const lineGap = sizes.ruledLineGap;
  const inputHeight = lineGap * sizes.inputMinLines;

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk wash={palette.tint} />
      {/* padding on both platforms: the page shrinks above the keyboard, so photo, stickers and tape can be scrolled into view while typing. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
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

          {/* The buddy keeps you company while you write: it hops with every keystroke and cheers for a photo. */}
          <BuddySays
            mood={previewUri ? 'cheer' : text.trim() ? 'happy' : 'wave'}
            accent={palette.primary}
            size={sizes.buddySmall}
            bump={`${text.length}-${developKey}`}
            text={
              canSave
                ? `Lovely. I'll bring this back on ${formatDisplayDate(resurfaceDate(today))}.`
                : 'One small thing from today? A note, a quote, a photo…'
            }
          />

          {/* Note card with ruled lines. */}
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
              {Array.from({ length: sizes.inputMinLines }, (_, i) => {
                const y = spacing.sm + lineGap * (i + 1) - spacing.xs;
                return <Line key={i} x1={0} x2={pageW} y1={y} y2={y} stroke={colors.ruleLine} strokeWidth={1} />;
              })}
              <Line x1={spacing.xxl} x2={spacing.xxl} y1={0} y2={inputHeight + spacing.sm} stroke={colors.marginLine} strokeWidth={1} />
            </Svg>
            {loaded ? (
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="A note, a quote, anything small…"
                placeholderTextColor={colors.inkMuted}
                multiline
                autoFocus={!isEdit}
                textAlignVertical="top"
                style={[
                  typography.body,
                  { color: colors.ink, lineHeight: lineGap, minHeight: inputHeight, paddingLeft: spacing.xl, paddingTop: spacing.xs },
                ]}
                accessibilityLabel="Today's note"
              />
            ) : (
              <View style={{ height: inputHeight }} />
            )}
          </View>

          {/* Polaroid photo picker: the photo develops when picked. */}
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <View style={{ transform: [{ rotate: '2deg' }] }}>
              <Polaroid
                key={developKey}
                width={polaroidW}
                uri={previewUri}
                tint={palette.primary}
                caption={previewUri ? formatMonthDay(today) : 'add a photo'}
                develop={developKey > 0}
              />
              {!previewUri ? (
                <View style={[StyleSheet.absoluteFill, styles.center, { paddingBottom: sizes.polaroidCaption }]} pointerEvents="none">
                  <Ionicons name="camera-outline" size={sizes.icon * 1.6} color={colors.inkMuted} />
                </View>
              ) : (
                <View style={{ position: 'absolute', top: -spacing.md, right: -spacing.md }}>
                  <CircleButton icon="trash-outline" accessibilityLabel="Remove photo" onPress={removePhoto} />
                </View>
              )}
            </View>
            <View style={[styles.row, { gap: spacing.md }]}>
              <PillButton label="Library" icon="images-outline" onPress={() => pick('library')} />
              <PillButton label="Camera" icon="camera-outline" onPress={() => pick('camera')} />
            </View>
          </View>

          {/* Live preview: how today's memory will look with the chosen sticker, tape and colors. */}
          <View style={{ gap: spacing.md }}>
            <Text style={[typography.label, { color: colors.onDesk }]}>How it will look</Text>
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
              <ScrapObject
                entry={{
                  id: entryId,
                  localDate: today,
                  text: text.trim() || (previewUri ? '' : 'Your moment goes here…'),
                  photoPath: existingEntry?.photoPath ?? null,
                  createdAt: existingEntry?.createdAt ?? today,
                  updatedAt: existingEntry?.updatedAt ?? today,
                  objectType: existingEntry?.objectType ?? null,
                  tapePattern: tape,
                  sticker,
                  stickerColor,
                  tapeColor,
                }}
                photoUri={previewUri}
                width={pageW * PREVIEW_RATIO}
                numberOfLines={4}
              />
            </View>
          </View>

          <Tray title="Sticker">
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
          </Tray>

          <ColorRow label="Sticker color" value={stickerColor} onChange={setStickerColor} year={palette} />

          <Tray title="Tape">
            <Chip selected={tape === null} onPress={() => setTape(null)} label="Surprise me">
              <Ionicons name="sparkles" size={sizes.icon} color={palette.primary} />
            </Chip>
            {TAPE_PATTERNS.map((pattern) => (
              <Chip key={pattern} selected={tape === pattern} onPress={() => setTape(pattern)} label={`${pattern} tape`}>
                <WashiTape width={sizes.swatch} color={tapePick.primary} color2={tapePick.secondary} pattern={pattern} angle={-8} />
              </Chip>
            ))}
          </Tray>

          <ColorRow label="Tape color" value={tapeColor} onChange={setTapeColor} year={palette} />
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
            borderColor: selected ? colors.onDesk : colors.paperWhite,
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
      <Text style={[typography.label, { color: colors.onDesk }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, padding: spacing.xs }}>
        {swatch('auto', year, value === null, () => onChange(null), `${label}: the year's color`, true)}
        {STYLE_PALETTES.map((p) => swatch(p.name, p, value === p.name, () => onChange(p.name), `${label}: ${p.name}`))}
      </ScrollView>
    </View>
  );
}

function Tray({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.label, { color: colors.onDesk }]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
        {children}
      </ScrollView>
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
  center: { alignItems: 'center', justifyContent: 'center' },
});
