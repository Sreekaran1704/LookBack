import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openBluetoothSettings } from '../../modules/lookback-nearby';
import { myPublicKey } from '../data/social/keys';
import type { NearbyPerson } from '../data/social/nearby';
import { sharingRepository } from '../data/sharingRepository';
import type { NearbyState } from '../hooks/useNearby';
import { parsePersonLink, personLink, type PersonCard } from '../lib/personLink';
import { selectHaptic } from '../lib/haptics';
import { useTheme, withAlpha } from '../theme';
import { PillButton } from './Buttons';
import { PersonButton } from './PersonSeal';

/** The QR code's size, and the ring that pulses while the phone looks for (or shows itself to) people nearby. */
const QR_SIZE = 184;
const RING = 64;
const PULSE_MS = 1600;

/** A soft ring pulsing out from an icon: this phone is looking, or being seen. */
function Pulse({ icon, on }: { icon: React.ComponentProps<typeof Ionicons>['name']; on: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || !on) return;
    pulse.set(withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }), -1, false));
  }, [pulse, reduceMotion, on]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - pulse.get()), transform: [{ scale: 0.6 + pulse.get() * 0.9 }] }));
  return (
    <View style={{ width: RING * 1.5, height: RING * 1.3, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, borderWidth: 2, borderColor: colors.gilt }, ringStyle]} />
      <Ionicons name={icon} size={34} color={colors.ink} />
    </View>
  );
}

/** What to do when nearby can't run yet: allow Bluetooth, or switch it on. Null when it's fine. */
function NearbyBlocked({ state, onRetry }: { state: NearbyState; onRetry: () => void }) {
  const { colors, typography } = useTheme();
  if (state === 'needs-permission')
    return (
      <>
        <Text style={[typography.caption, { color: colors.inkMuted, textAlign: 'center', alignSelf: 'stretch' }]}>LookBack needs Bluetooth to find the people beside you.</Text>
        <PillButton label="Allow nearby" icon="bluetooth" onPress={onRetry} />
      </>
    );
  if (state === 'offline')
    return (
      <>
        <Text style={[typography.caption, { color: colors.inkMuted, textAlign: 'center', alignSelf: 'stretch' }]}>{"Couldn't reach LookBack's server, so people nearby can't find you yet. Check your connection."}</Text>
        <PillButton label="Try again" icon="refresh" onPress={onRetry} />
      </>
    );
  if (state === 'starting') return null;
  if (state === 'bluetooth-off')
    return (
      <>
        <Text style={[typography.caption, { color: colors.inkMuted, textAlign: 'center', alignSelf: 'stretch' }]}>Turn on Bluetooth to find the people beside you.</Text>
        <PillButton label="Turn on Bluetooth" icon="bluetooth" onPress={openBluetoothSettings} />
      </>
    );
  return null;
}

/**
 * People beside you with Shared open, by name, closest first (Blip style). Tap one to add them (or, while
 * giving a page, to give it to them straight away). Nobody here yet: a gentle "looking…" with how to be found.
 */
export function NearbyPeople({ state, people, onRetry, onPick, actionLabel, busy, compact = false }: { state: NearbyState; people: NearbyPerson[]; onRetry: () => void; onPick: (person: NearbyPerson) => void; actionLabel: (name: string) => string; busy: boolean; compact?: boolean }) {
  const { colors, typography, spacing } = useTheme();
  if (state === 'unsupported') return null;
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, alignSelf: 'stretch' }}>
      {compact ? null : <Pulse icon="people-outline" on={state === 'on' && people.length === 0} />}
      {state === 'on' ? (
        people.length > 0 ? (
          <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
            {people.map((p) => (
              <PersonButton key={p.token} id={p.id} name={p.name} label={actionLabel(p.name)} disabled={busy} onPress={() => onPick(p)} />
            ))}
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.inkMuted, textAlign: 'center', alignSelf: 'stretch' }]}>
            Looking for people beside you… ask them to open Shared on their phone.
          </Text>
        )
      ) : (
        <NearbyBlocked state={state} onRetry={onRetry} />
      )}
    </View>
  );
}

/** Receiving: whether this phone can be found by the people beside you, and under what name. */
export function VisibleNearby({ state, name, onRetry, compact = false }: { state: NearbyState; name: string; onRetry: () => void; compact?: boolean }) {
  const { colors, typography, spacing } = useTheme();
  if (state === 'unsupported') return null;
  if (compact && state === 'on')
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'stretch' }}>
        <Ionicons name="radio-outline" size={18} color={colors.gilt} />
        <Text style={[typography.caption, { color: colors.inkMuted, flex: 1 }]}>People beside you can find you as {name} while this page is open.</Text>
      </View>
    );
  return (
    <View style={{ alignItems: 'center', gap: spacing.xs, alignSelf: 'stretch' }}>
      {state === 'on' ? (
        <>
          <Pulse icon="radio-outline" on />
          <Text style={[typography.print, { color: colors.ink, textAlign: 'center', alignSelf: 'stretch' }]}>People beside you can find you as {name}.</Text>
          <Text style={[typography.caption, { color: colors.inkMuted, textAlign: 'center', alignSelf: 'stretch' }]}>Keep this page open while they give.</Text>
        </>
      ) : (
        <NearbyBlocked state={state} onRetry={onRetry} />
      )}
    </View>
  );
}

/** The picture of your code that's shared: big, ink on white paper, with room around it to scan from a photo. */
const SHARE_SIZE = 720;

/** This phone's key, once read (made the first time). */
function useMyKey(): string | null {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    myPublicKey().then((k) => live && setKey(k), () => undefined);
    return () => {
      live = false;
    };
  }, []);
  return key;
}

/**
 * Your card as a QR code, for someone to add you with their camera, or shared as a picture (any chat app) for them to
 * scan from their photos. It holds only who you are and your phone's key, never a memory.
 */
export function MyCard({ id, name }: { id: string; name: string }) {
  const { colors, typography, spacing } = useTheme();
  const key = useMyKey();
  const shareRef = useRef<{ toDataURL: (cb: (base64: string) => void, options?: object) => void } | null>(null);
  const [problem, setProblem] = useState('');
  const link = personLink(id, name, key);
  const share = () => {
    setProblem('');
    const svg = shareRef.current;
    if (!svg) return;
    svg.toDataURL((base64) => {
      sharingRepository
        .saveCodeImage(base64)
        .then((uri) => Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `Add ${name} on LookBack` }))
        .catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)));
    }, { width: SHARE_SIZE, height: SHARE_SIZE });
  };
  return (
    <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
      <View style={{ padding: spacing.md, borderRadius: 8, backgroundColor: colors.paperWhite }}>
        <QRCode value={link} size={QR_SIZE} color={colors.ink} backgroundColor={colors.paperWhite} ecl="M" />
      </View>
      {/* The plain copy that becomes the shared picture (drawn off screen). */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -10_000, top: 0 }}>
        <QRCode value={link} size={SHARE_SIZE} color={colors.ink} backgroundColor={colors.paperWhite} quietZone={48} ecl="M" getRef={(c: typeof shareRef.current) => (shareRef.current = c)} />
      </View>
      <Text style={[typography.caption, { color: colors.inkMuted, textAlign: 'center', alignSelf: 'stretch' }]}>
        They scan this in their LookBack to add you as {name}, or you share it and they scan it from their photos. It only says who you are.
      </Text>
      <PillButton label="Share code" icon="share-outline" onPress={share} disabled={!key} />
      {problem ? <Text style={[typography.caption, { color: colors.inkMuted, textAlign: 'center', alignSelf: 'stretch' }]}>{problem}</Text> : null}
    </View>
  );
}

/**
 * Scanning someone's card on their screen: the camera, full screen, with a frame to aim at. A LookBack card closes it
 * and hands the person back; any other QR code is ignored.
 */
export function ScanPerson({ visible, onPerson, onClose }: { visible: boolean; onPerson: (person: PersonCard) => void; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);
  const [photoProblem, setPhotoProblem] = useState('');
  useEffect(() => {
    if (visible) done.current = false;
  }, [visible]);
  const close = () => {
    setPhotoProblem('');
    onClose();
  };
  // A code someone shared as a picture: pick it from your photos and read it.
  const fromPhoto = async () => {
    setPhotoProblem('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    const codes = await scanFromURLAsync(asset.uri, ['qr']).catch(() => []);
    const person = codes.map((c) => parsePersonLink(c.data)).find((p) => p) ?? null;
    if (!person) {
      setPhotoProblem("That picture doesn't have a LookBack code in it.");
      return;
    }
    if (done.current) return;
    done.current = true;
    setPhotoProblem('');
    selectHaptic();
    onPerson(person);
  };
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              const person = parsePersonLink(data);
              if (!person || done.current) return;
              done.current = true;
              selectHaptic();
              onPerson(person);
            }}
          />
        ) : null}
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: spacing.gutter, gap: spacing.lg }]}>
          {permission?.granted ? (
            <>
              <View pointerEvents="none" style={{ width: 240, height: 240, borderRadius: 18, borderWidth: 3, borderColor: withAlpha(colors.paperWhite, 0.9) }} />
              <Text style={[typography.print, { color: colors.paperWhite, textAlign: 'center', alignSelf: 'stretch' }]}>Point at the code on their LookBack</Text>
              <PillButton label="From a photo" icon="images-outline" onPress={() => void fromPhoto()} />
              {photoProblem ? <Text style={[typography.caption, { color: colors.paperWhite, textAlign: 'center', alignSelf: 'stretch' }]}>{photoProblem}</Text> : null}
            </>
          ) : (
            <>
              <Text style={[typography.print, { color: colors.paperWhite, textAlign: 'center', alignSelf: 'stretch' }]}>
                {permission?.canAskAgain === false ? 'Camera access is off for LookBack. You can switch it on in Settings, or add them nearby instead.' : 'LookBack needs the camera to scan their code.'}
              </Text>
              {permission?.canAskAgain !== false ? <PillButton label="Allow the camera" icon="camera-outline" onPress={() => void requestPermission()} /> : null}
              <PillButton label="From a photo" icon="images-outline" onPress={() => void fromPhoto()} />
              {photoProblem ? <Text style={[typography.caption, { color: colors.paperWhite, textAlign: 'center', alignSelf: 'stretch' }]}>{photoProblem}</Text> : null}
            </>
          )}
        </View>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close the scanner" hitSlop={12} style={{ position: 'absolute', top: insets.top + spacing.md, right: spacing.gutter, width: 44, height: 44, borderRadius: 22, backgroundColor: withAlpha('#000000', 0.5), alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={24} color={colors.paperWhite} />
        </Pressable>
      </View>
    </Modal>
  );
}
