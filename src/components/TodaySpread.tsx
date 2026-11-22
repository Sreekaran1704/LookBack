import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { entriesRepository, newEntryId, resolvePhotoUri, type Entry } from '../data';
import { formatDiaryDate, formatDisplayDate, resurfaceDate } from '../lib/dates';
import { successHaptic, tapHaptic } from '../lib/haptics';
import { formatVoiceMs } from '../lib/voice';
import { useTheme, withAlpha } from '../theme';
import { useStatusPill } from './StatusPill';
import Svg, { Path } from 'react-native-svg';
import { Cassette } from './scrapbook/Cassette';
import { Raster } from './scrapbook/Raster';
import { Texture } from './scrapbook/Texture';
import { vintageFilm } from './scrapbook/shared';

interface Props {
  /** Today's page, or null when nothing is written yet. */
  entry: Entry | null;
  today: string;
  width: number;
  /** Opens today's page (from its photo or tape). */
  onOpen: () => void;
  /** The full writing page, for adding a photo or a voice note. */
  onWrite: () => void;
  /** Called as writing starts, so the page can scroll the spread above the keyboard. */
  onStartWriting?: () => void;
}

/** The open book: its height for its width, the cover showing around the pages, and the page stack under them. */
const SPREAD_RATIO = 0.74;
const COVER = 7;
const STACK = 4;
const LINE_GAP = 22;
/** The polaroid on the left page and the tape pouch. */
const POLAROID_RATIO = 0.8;
const POUCH_RATIO = 0.84;
const POUCH_LEATHER = '#6B4A2E';
const POUCH_STITCH = 'rgba(233, 205, 150, 0.7)';
const TAPE_STRIP = 'rgba(245, 238, 220, 0.75)';
const POLAROID = '#FBFAF6';

/**
 * "Today" on Home: the diary lying open at today's page, and you write on it right here. The right page starts "Dear me,"
 * on its ruled lines; tap it and write in your own hand, then "keep it" (or just put the keyboard away). The left page
 * holds a photo as a taped polaroid or a voice note as a cassette in its pouch, or the date with "+ a photo" and
 * "+ your voice", which open the full writing page for those.
 */
export function TodaySpread({ entry, today, width, onOpen, onWrite, onStartWriting }: Props) {
  const theme = useTheme();
  const { colors, typography, spacing } = theme;
  const statusPill = useStatusPill();
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const h = width * SPREAD_RATIO;
  const pageW = (width - COVER * 2) / 2;
  const pageH = h - COVER * 2 - STACK;
  const uri = entry?.photoPath ? resolvePhotoUri(entry.photoPath) : null;
  const words = entry?.text.trim() ?? '';
  const hasVoice = entry?.voicePath != null;

  const page = (side: 'left' | 'right', children: React.ReactNode) => (
    <View
      style={{
        width: pageW,
        height: pageH,
        backgroundColor: colors.paper,
        borderTopLeftRadius: side === 'left' ? 6 : 1,
        borderBottomLeftRadius: side === 'left' ? 6 : 1,
        borderTopRightRadius: side === 'right' ? 6 : 1,
        borderBottomRightRadius: side === 'right' ? 6 : 1,
        overflow: 'hidden',
        // The page curves down into the gutter: a shade along its bound edge, light across its middle.
        backgroundImage:
          side === 'left'
            ? 'linear-gradient(90deg, rgba(0,0,0,0.03) 0%, rgba(255,255,255,0.25) 45%, rgba(0,0,0,0.05) 82%, rgba(0,0,0,0.22) 100%)'
            : 'linear-gradient(90deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.05) 18%, rgba(255,255,255,0.25) 55%, rgba(0,0,0,0.03) 100%)',
        padding: spacing.md,
      }}
    >
      <Texture kind="paper" opacity={0.45} />
      {children}
    </View>
  );

  const polaroidW = pageW * POLAROID_RATIO;
  const polaroid = uri ? (
    <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
      <View style={{ width: polaroidW, padding: polaroidW * 0.06, paddingBottom: polaroidW * 0.2, backgroundColor: POLAROID, transform: [{ rotate: '-3deg' }], boxShadow: '0px 3px 6px rgba(0,0,0,0.3)' }}>
        <Texture kind="paper" opacity={0.4} />
        <View style={[{ width: '100%', aspectRatio: 1 }, vintageFilm(theme)]}>
          <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" transition={theme.motion.imageFadeMs} cachePolicy="memory-disk" />
        </View>
        {/* A strip of tape holding it to the page. */}
        <View style={{ position: 'absolute', top: -8, left: polaroidW * 0.3, width: polaroidW * 0.4, height: 16, backgroundColor: TAPE_STRIP, transform: [{ rotate: '4deg' }], borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }} />
      </View>
    </View>
  ) : null;

  const pouchW = pageW * POUCH_RATIO;
  const pouch = hasVoice ? (
    <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
      <View style={{ width: pouchW, height: pouchW * 0.56 }}>
        {/* The cassette standing in the pouch, the top of it showing. */}
        <View style={{ position: 'absolute', left: pouchW * 0.06, top: 0 }}>
          <Cassette width={pouchW * 0.88} title={entry?.voiceTitle || formatDisplayDate(today)} detail={formatVoiceMs(entry?.voiceMs)} />
        </View>
        {/* The leather pouch, stitched, with a flap of shadow at its mouth. */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: pouchW * 0.3,
            borderRadius: 6,
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
            backgroundColor: POUCH_LEATHER,
            backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 30%, rgba(255,255,255,0.08) 70%, rgba(0,0,0,0.2) 100%)',
            boxShadow: '0px 3px 6px rgba(0,0,0,0.35)',
          }}
        >
          <View style={{ position: 'absolute', left: 4, right: 4, top: 4, bottom: 4, borderRadius: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: POUCH_STITCH }} />
        </View>
      </View>
    </View>
  ) : null;

  const ruled = (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: Math.floor(pageH / LINE_GAP) }, (_, i) => (
        <View key={i} style={{ position: 'absolute', left: spacing.sm, right: spacing.sm, top: spacing.xl + LINE_GAP * (i + 1), height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.ruleLine }} />
      ))}
    </View>
  );

  // Writing on the page itself: the words become a text box in the same hand, and are kept when you're done.
  const startWriting = () => {
    tapHaptic();
    setDraft(entry?.text ?? '');
    setWriting(true);
    onStartWriting?.();
  };
  const keep = async () => {
    if (!writing || saving) return;
    const text = draft;
    const changed = text.trim() !== (entry?.text.trim() ?? '');
    const empty = text.trim().length === 0 && !uri && !hasVoice;
    if (!changed || empty) {
      setWriting(false);
      return;
    }
    setSaving(true);
    try {
      await entriesRepository.saveForDate({ id: entry?.id ?? newEntryId(), localDate: today, text, photo: { kind: 'keep' } });
      successHaptic();
      statusPill.show(`Kept until ${formatDisplayDate(resurfaceDate(today))}`);
      setWriting(false);
    } catch (error) {
      Alert.alert("Couldn't keep it", error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const link = (label: string, onPress: () => void, a11y: string) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={8}>
      <Text style={[typography.hand, { color: colors.sepia, fontSize: 18, lineHeight: 22, paddingRight: 0 }]}>{label} </Text>
    </Pressable>
  );

  const rightPage = (
    <View style={{ flex: 1 }}>
      {ruled}
      <Text numberOfLines={2} style={[typography.caption, { color: colors.sepia, fontSize: 13, lineHeight: 18 }]}>
        {formatDiaryDate(today)}
      </Text>
      {writing ? (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={() => void keep()}
            autoFocus
            multiline
            placeholder="What's weighing on you today?"
            placeholderTextColor={colors.inkFaint}
            textAlignVertical="top"
            cursorColor={colors.inkBlue}
            selectionColor={withAlpha(colors.inkBlue, 0.3)}
            selectionHandleColor={colors.inkBlue}
            accessibilityLabel="Today's page"
            style={[typography.hand, { flex: 1, color: colors.inkBlue, fontSize: 19, lineHeight: LINE_GAP, marginTop: spacing.xs, padding: 0, paddingRight: 0 }]}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
            {link('+ photo', onWrite, 'Add a photo or a voice note')}
            {link(saving ? 'keeping…' : 'keep ✓', () => void keep(), "Keep today's page")}
          </View>
        </>
      ) : (
        <Pressable onPress={startWriting} accessibilityRole="button" accessibilityLabel={words ? "Write on today's page" : "Write today's page"} style={{ flex: 1 }}>
          {words ? (
            <Text numberOfLines={uri && hasVoice ? 2 : 6} style={[typography.hand, { color: colors.inkBlue, fontSize: 19, lineHeight: LINE_GAP, marginTop: spacing.xs }]}>
              {words}
            </Text>
          ) : (
            <>
              <Text style={[typography.hand, { color: colors.inkBlue, fontSize: 21, lineHeight: LINE_GAP, marginTop: spacing.xs }]}>Dear me, </Text>
              <Text style={[typography.hand, { color: withAlpha(colors.ink, 0.35), fontSize: 18, lineHeight: LINE_GAP }]}>what&apos;s weighing on you today? </Text>
            </>
          )}
          {uri ? pouch : null}
          <View style={{ flex: 1 }} />
          {words ? null : (
            // Nothing written yet: say so plainly, in ink, at the foot of the page.
            <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs, borderBottomWidth: 1, borderBottomColor: withAlpha(colors.sepia, 0.5), paddingBottom: 1 }}>
              <Ionicons name="pencil" size={14} color={colors.sepia} />
              <Text style={[typography.printItalic, { fontSize: 18, lineHeight: 24, color: colors.sepia, paddingRight: 0 }]}>write now </Text>
            </View>
          )}
          {words ? (
            <View style={{ alignSelf: 'flex-end', marginTop: spacing.xs }}>
              <View style={{ width: 78, height: 32, transform: [{ rotate: '-3deg' }] }}>
                {/* A scrap held to the page with the same translucent tape as the photo. */}
                <Svg pointerEvents="none" width={78} height={34} style={StyleSheet.absoluteFill}>
                  <Path d="M1 2 L76 1 L77 29 L72 30 L66 29 L59 32 L52 30 L45 31 L38 29 L31 32 L24 30 L17 31 L10 29 L2 31 Z" fill="rgba(66,43,20,0.17)" transform="translate(0 1.5)" />
                  <Path d="M1 1 L76 0 L77 28 L72 29 L66 28 L59 31 L52 29 L45 30 L38 28 L31 31 L24 29 L17 30 L10 28 L2 30 Z" fill={colors.paperWhite} stroke="rgba(110,83,47,0.12)" strokeWidth={0.5} />
                </Svg>
                <View pointerEvents="none" style={{ position: 'absolute', left: 2, right: 2, top: 1, height: 26 }}><Texture kind="paper" opacity={0.4} /></View>
                <View pointerEvents="none" style={{ position: 'absolute', left: 5, top: -3, width: 24, height: 8, backgroundColor: TAPE_STRIP, transform: [{ rotate: '-7deg' }], borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: 'rgba(92,72,40,0.08)' }} />
                <Text style={[typography.printItalic, { fontSize: 18, lineHeight: 28, color: colors.sepia, textAlign: 'center', paddingRight: 0 }]}>edit </Text>
                <Svg pointerEvents="none" width={78} height={32} style={StyleSheet.absoluteFill}><Path d="M25 25 Q39 23.5 54 25" stroke={colors.sepia} strokeWidth={0.7} opacity={0.6} fill="none" strokeLinecap="round" /></Svg>
              </View>
            </View>
          ) : null}
        </Pressable>
      )}
    </View>
  );

  // The left page: the photo or the tape, or the date with a way to add them.
  const leftPage =
    uri || hasVoice ? (
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open today's page" style={{ flex: 1 }}>
        {polaroid}
        {uri ? null : pouch}
      </Pressable>
    ) : (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
        <Text style={[typography.stampLarge, { color: colors.sepia, fontSize: 34, lineHeight: 38, paddingRight: 0 }]}>{today.slice(8)}</Text>
        <Text style={[typography.caption, { color: colors.inkMuted, alignSelf: 'stretch', textAlign: 'center' }]}>{entry ? 'today' : 'a fresh page'} </Text>
        <View style={{ marginTop: spacing.md, alignItems: 'center', gap: spacing.xs }}>
          {link('+ a photo', onWrite, 'Add a photo to today')}
          {link('+ your voice', onWrite, 'Record a voice note for today')}
        </View>
      </View>
    );

  const spread = (
    <View style={{ width, height: h, padding: COVER, paddingBottom: COVER + STACK }}>
      {/* The cover, showing around the pages, and the page stack under them. */}
      <View style={[StyleSheet.absoluteFill, { borderRadius: 10, backgroundColor: colors.deskDeep, boxShadow: theme.shadow(undefined, 1.4), borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)' }]} />
      <View style={{ position: 'absolute', left: COVER + 2, right: COVER + 2, bottom: COVER - 1, height: STACK + 2, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: colors.paperWhite, borderTopWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }} />
      <View style={{ flexDirection: 'row' }}>
        {page('left', leftPage)}
        {page('right', rightPage)}
      </View>
      {/* The gutter where the pages meet. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: width / 2 - 1, top: COVER, bottom: COVER + STACK, width: 2, backgroundColor: 'rgba(0,0,0,0.18)' }} />
    </View>
  );

  // Kept as a texture while it sits still; live while you write on it.
  return <Raster enabled={!writing}>{spread}</Raster>;
}
