import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { PillButton } from '../components/Buttons';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { ActionBar, PageHeader, usePageContentStyle, type BarAction } from '../components/Screen';
import { useStatusPill } from '../components/StatusPill';
import { Buddy } from '../components/scrapbook/Buddy';
import { PaperBackground } from '../components/scrapbook/PaperBackground';
import { ScrapObject } from '../components/scrapbook/ScrapObject';
import { ShredAway } from '../components/scrapbook/ShredAway';
import { sheetIn, sheetOut } from '../components/transitions';
import { VoiceStrip, useVoiceRecording, type VoiceDraft } from '../components/VoiceRecorder';
import { entriesRepository, newEntryId, resolvePhotoUri, resolveVoiceUri, type Entry, type PhotoChange, type VoiceChange } from '../data';
import { useToday } from '../hooks/useData';
import { useVoicePlayback } from '../hooks/useVoicePlayback';
import { formatDisplayDate, resurfaceDate } from '../lib/dates';
import { rejectHaptic, successHaptic, thudHaptic } from '../lib/haptics';
import { useTheme } from '../theme';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
/** The page is what you write on, so it is drawn big. */
const PAGE_RATIO = 0.92;
/** On saving, the page is shown this wide while the seal is pressed onto it. */
const SEALED_RATIO = 0.7;
/** The wax seal: its size, and how big it starts before it is pressed down. */
const SEAL_SIZE = 92;
const SEAL_FROM = 1.8;
const SEAL_DELAY_MS = 260;

/**
 * Today's page. The diary page itself is the text box: you write on its ruled lines, in your own hand. Photo adds
 * (or changes) a photo, held by photo corners; Voice records a tape, which is tucked into a pocket on the page.
 * Seal saves it, pressing a wax seal onto the page: it comes back to you on this day next year. The buttons sit at
 * the foot, in reach of a thumb, and ride up with the keyboard.
 */
export default function EntryScreen() {
  const theme = useTheme();
  const { colors, spacing, typography } = theme;
  const pageContent = usePageContentStyle({ withNavBar: false, gap: false, thumbBar: true });
  const { width } = useWindowDimensions();
  const today = useToday();
  const statusPill = useStatusPill();
  const reduceMotion = useReducedMotion();

  const [loaded, setLoaded] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<PhotoChange>({ kind: 'keep' });
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  // Known before saving, so the page you see is exactly the one saved.
  const [entryId, setEntryId] = useState(newEntryId);
  const [existingEntry, setExistingEntry] = useState<Entry | null>(null);
  const [saving, setSaving] = useState(false);
  const [sealing, setSealing] = useState<Entry | null>(null);
  /** Taking the voice note off asks first (only the voice goes; the words and photo stay). */
  const [askRemoveVoice, setAskRemoveVoice] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [shredding, setShredding] = useState<Entry | null>(null);
  const [voice, setVoice] = useState<VoiceChange>({ kind: 'keep' });
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const voicePlayer = useVoicePlayback(voiceDraft?.uri ?? null);
  const rec = useVoiceRecording((draft) => changeVoice(draft));

  useEffect(() => {
    entriesRepository.getByDate(today).then((existing) => {
      if (existing) {
        setIsEdit(true);
        setText(existing.text);
        setPreviewUri(existing.photoPath ? resolvePhotoUri(existing.photoPath) : null);
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
    setPhotoSheet(false);
  }

  function removePhoto() {
    setPhoto(existingEntry?.photoPath ? { kind: 'remove' } : { kind: 'keep' });
    setPreviewUri(null);
    setPhotoSheet(false);
  }

  function changeVoice(draft: VoiceDraft | null) {
    setVoiceDraft(draft);
    if (draft) setVoice({ kind: 'set', sourceUri: draft.uri, wave: draft.wave, ms: draft.ms });
    else setVoice(existingEntry?.voicePath ? { kind: 'remove' } : { kind: 'keep' });
  }

  const canSave = loaded && !saving && (text.trim().length > 0 || previewUri !== null || voiceDraft !== null);
  const comesBack = formatDisplayDate(resurfaceDate(today));

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const saved = await entriesRepository.saveForDate({ localDate: today, text, photo, voice, id: entryId });
      successHaptic();
      const message = `Sealed until ${comesBack}`;
      if (reduceMotion) {
        statusPill.show(message);
        router.back();
        return;
      }
      setSealing(saved);
      setTimeout(() => {
        statusPill.show(message);
        router.back();
      }, theme.motion.celebrationMs + SEAL_DELAY_MS);
    } catch (error) {
      setSaving(false);
      Alert.alert("Couldn't save", error instanceof Error ? error.message : String(error));
    }
  }

  const pageW = (width - spacing.gutter * 2) * PAGE_RATIO;
  // The page as it will be saved.
  const previewEntry: Entry = {
    id: entryId,
    localDate: today,
    text,
    photoPath: previewUri ? (existingEntry?.photoPath ?? 'preview') : null,
    createdAt: existingEntry?.createdAt ?? today,
    updatedAt: existingEntry?.updatedAt ?? today,
    reply: existingEntry?.reply ?? null,
    repliedAt: existingEntry?.repliedAt ?? null,
    objectType: existingEntry?.objectType ?? null,
    tapePattern: existingEntry?.tapePattern ?? null,
    sticker: existingEntry?.sticker ?? null,
    stickerColor: existingEntry?.stickerColor ?? null,
    tapeColor: existingEntry?.tapeColor ?? null,
    voicePath: voiceDraft ? (existingEntry?.voicePath ?? 'preview') : null,
    voiceWave: voiceDraft?.wave ?? null,
    voiceMs: voiceDraft?.ms ?? null,
  };

  const actions: BarAction[] = [
    { key: 'close', icon: 'close', label: 'Close', onPress: () => router.back() },
    {
      key: 'photo',
      icon: 'image-outline',
      label: 'Photo',
      tint: colors.giltBright,
      active: photoSheet,
      onPress: () => setPhotoSheet((open) => !open),
    },
    // Voice starts a recording (and stops it). Once there is a tape, the strip above has Listen / Re-record / Remove.
    ...(voiceDraft && !rec.recording
      ? []
      : [
          {
            key: 'voice',
            icon: rec.recording ? ('stop' as const) : ('mic-outline' as const),
            label: rec.recording ? 'Stop' : 'Voice',
            tint: colors.giltBright,
            active: rec.recording,
            accessibilityLabel: rec.recording ? 'Stop recording' : 'Record a voice note',
            onPress: () => {
              setPhotoSheet(false);
              void (rec.recording ? rec.stop() : rec.start());
            },
          },
        ]),
    ...(existingEntry ? [{ key: 'delete', icon: 'trash-outline' as const, label: 'Delete', accessibilityLabel: "Delete today's page", onPress: () => setAskDelete(true) }] : []),
    { key: 'save', icon: 'checkmark', label: isEdit ? 'Update' : 'Seal', primary: colors.primary, disabled: !canSave || rec.recording, onPress: save },
  ];

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      {/* padding on both platforms: the page shrinks above the keyboard, so everything can be scrolled into view while typing. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[pageContent, { gap: spacing.xl }, Platform.OS === 'ios' ? { paddingTop: spacing.xl } : null]}
        >
          {/* The date is at the top of the page itself, as a diary writes it, so the title just says whose page this is. */}
          <PageHeader title="Today's page" accent={colors.gilt} />

          {/* Today's page, live: you write on it. */}
          <View style={{ alignItems: 'center', gap: spacing.lg }}>
            <ScrapObject
              entry={previewEntry}
              photoUri={previewUri}
              width={pageW}
              raster={false}
              voicePlayer={voicePlayer}
              editor={
                loaded
                  ? {
                      value: text,
                      onChangeText: setText,
                      placeholder: 'What is weighing on you today?',
                      autoFocus: !isEdit && !voiceDraft,
                      onFocus: () => setPhotoSheet(false),
                      accessibilityLabel: "Today's page",
                    }
                  : undefined
              }
            />
            <Text style={[typography.caption, { color: colors.onDeskMuted, textAlign: 'center', alignSelf: 'stretch' }]}>
              {canSave ? `Seal it, and it comes back to you on ${comesBack}.` : 'Write it as it is. No one reads this but you, a year from now.'}
            </Text>
          </View>
        </ScrollView>

        {/* Photo choices, in a sheet just above the buttons. */}
        {photoSheet ? (
          <Animated.View
            entering={sheetIn(reduceMotion)}
            exiting={sheetOut(reduceMotion)}
            style={{ marginHorizontal: spacing.gutter, marginBottom: spacing.sm, backgroundColor: colors.panel, borderRadius: 6, padding: spacing.md, gap: spacing.md, boxShadow: theme.shadow(undefined, 1) }}
          >
            <Text style={[typography.label, { color: colors.ink }]}>{previewUri ? 'Another photo?' : 'Tuck a photo into the page'}</Text>
            <View style={[styles.row, { gap: spacing.md }]}>
              <PillButton label="Library" icon="images-outline" grow onPress={() => pick('library')} />
              <PillButton label="Camera" icon="camera-outline" grow onPress={() => pick('camera')} />
            </View>
            {previewUri ? <PillButton label="Take the photo out" icon="close" onPress={removePhoto} /> : null}
          </Animated.View>
        ) : null}
        {/* The page's buttons at the foot, where a thumb reaches them; they ride up with the keyboard. */}
        <VoiceStrip rec={rec} value={rec.recording ? null : voiceDraft} player={voicePlayer} onRemove={() => setAskRemoveVoice(true)} accent={colors.giltBright} />
        <ActionBar withNavBar={false} actions={actions} />
      </KeyboardAvoidingView>

      {sealing ? <SealPress entry={sealing} width={width * SEALED_RATIO} until={comesBack} /> : null}
      <ConfirmSheet
        visible={askRemoveVoice}
        title="Take the tape out?"
        message={`Only the voice note goes; your words${previewUri ? ' and photo stay' : ' stay'}.${existingEntry?.voicePath ? " It's gone for good once you tap Update." : ''}`}
        confirmLabel="Take it out"
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
          title="Tear out today's page?"
          message={`Today's page${existingEntry.photoPath ? ', photo and all,' : existingEntry.voicePath ? ', voice and all,' : ''} leaves this phone now, and your Drive backup at the next backup. There's no getting it back.`}
          confirmLabel="Tear it out"
          confirmIcon="trash-outline"
          onConfirm={() => {
            setAskDelete(false);
            rejectHaptic();
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
          onCancel={() => setShredding(null)}
        />
      ) : null}
    </View>
  );
}

/**
 * Saving: the page settles in the middle, and a wax seal with the diary's stamp in it comes down onto its corner
 * with a soft thud. Then the line it is sealed until.
 */
function SealPress({ entry, width, until }: { entry: Entry; width: number; until: string }) {
  const theme = useTheme();
  const { colors, typography, spacing, motion } = theme;
  const page = useSharedValue(0);
  const scrim = useSharedValue(0);
  const seal = useSharedValue(0);
  useEffect(() => {
    scrim.set(withTiming(1, { duration: motion.imageFadeMs }));
    page.set(withSpring(1, motion.lift));
    seal.set(withDelay(SEAL_DELAY_MS, withTiming(1, { duration: 240 })));
    const t = setTimeout(thudHaptic, SEAL_DELAY_MS + 220);
    return () => clearTimeout(t);
  }, [page, scrim, seal, motion.imageFadeMs, motion.lift]);
  const pageStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.85 + 0.15 * page.get() }], opacity: Math.min(1, page.get() * 2) }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));
  const sealStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, seal.get() * 1.6), transform: [{ scale: SEAL_FROM - (SEAL_FROM - 1) * seal.get() }, { rotate: '-12deg' }] }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: seal.get() }));
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="auto">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]} />
      <Animated.View style={pageStyle}>
        <ScrapObject entry={entry} width={width} numberOfLines={6} lift={2} />
        {/* The wax seal, pressed onto the page's lower corner, with the diary's stamp in it. */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              right: -SEAL_SIZE * 0.25,
              bottom: -SEAL_SIZE * 0.3,
              width: SEAL_SIZE,
              height: SEAL_SIZE,
              borderRadius: SEAL_SIZE / 2,
              backgroundColor: colors.wax,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0px 6px 12px rgba(0,0,0,0.5), inset 0px 0px 0px 6px rgba(0,0,0,0.14), inset 0px 3px 6px rgba(255,200,180,0.25)`,
            },
            sealStyle,
          ]}
        >
          <Buddy size={SEAL_SIZE * 0.78} entrance={false} />
        </Animated.View>
      </Animated.View>
      <Animated.Text style={[typography.caption, { color: colors.onDesk, marginTop: spacing.xxl, textAlign: 'center', alignSelf: 'stretch' }, lineStyle]}>
        Sealed until {until}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
