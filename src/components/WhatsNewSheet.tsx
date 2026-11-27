import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { useProfile } from '../hooks/useData';
import { defaultPortrait, PORTRAIT_OPTIONS, portraitFor, type Portrait, type PortraitPart } from '../lib/portrait';
import { usePeople } from '../hooks/useSharing';
import type { WhatsNewCard, WhatsNewPicture } from '../lib/whatsNew';
import { cassetteStyle, mixHex, useTheme, withAlpha } from '../theme';
import { PillButton } from './Buttons';
import { Cassette } from './scrapbook/Cassette';
import { FilmPortrait, PortraitSticker } from './scrapbook/FilmPortrait';
import { RecordingDeck } from './scrapbook/RecordingDeck';
import { HAND_TAIL } from './Screen';
import { sheetIn } from './transitions';

const WIDGET_TODAY = require('../../assets/widget-preview.png');
const WIDGET_PERSON = require('../../assets/widget-person-preview.png');
/** Height of each card's picture, so the words line up from card to card. */
const PICTURE_H = 210;

interface Props {
  visible: boolean;
  version: string;
  cards: WhatsNewCard[];
  onDone: () => void;
}

/**
 * "What's new", once after an update: a diary page over the dimmed app with a few cards to swipe through, each a live
 * picture made of the app's own pieces (the cassettes, the recording deck, a sealed envelope, portraits, the widgets),
 * a title and a line or two. Next / Lovely at the foot, Skip at any time; tapping outside or Back closes it too.
 */
export function WhatsNewSheet({ visible, version, cards, onDone }: Props) {
  const theme = useTheme();
  const { colors, spacing, typography } = theme;
  const reduceMotion = useReducedMotion();
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.min(screenW - spacing.gutter * 2, 440);
  const inner = cardW - spacing.lg * 2;
  const [page, setPage] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const last = page >= cards.length - 1;

  const go = (to: number) => {
    setPage(to);
    scroller.current?.scrollTo({ x: to * cardW, animated: !reduceMotion });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onDone}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.paper.darkDeep, 0.6) }]}>
        <Pressable accessibilityLabel="Close" onPress={onDone} style={StyleSheet.absoluteFill} />
        <View pointerEvents="box-none" style={styles.center}>
          <Animated.View entering={sheetIn(reduceMotion)} style={{ width: cardW, borderRadius: 10, backgroundColor: colors.panel, boxShadow: theme.shadow(undefined, 2), overflow: 'hidden' }}>
            {/* The page's red margin, as on every diary page. */}
            <View pointerEvents="none" style={{ position: 'absolute', left: 14, top: 0, bottom: 0, width: 1, backgroundColor: colors.marginLine }} />
            <View style={{ paddingTop: spacing.lg, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[typography.stamp, { color: colors.gilt, flex: 1 }]}>{`WHAT'S NEW · ${version}`}</Text>
              {last ? null : (
                <Pressable onPress={onDone} hitSlop={12} accessibilityRole="button">
                  <Text style={[typography.handSmall, { color: colors.inkMuted }]}>Skip </Text>
                </Pressable>
              )}
            </View>
            <ScrollView
              ref={scroller}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / cardW))}
            >
              {cards.map((card, i) => (
                <View key={card.title} style={{ width: cardW, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                  <View style={{ height: PICTURE_H, alignItems: 'center', justifyContent: 'center' }}>
                    {/* Only the card in view and its neighbours are drawn (the recording deck animates). */}
                    {Math.abs(i - page) <= 1 ? <Picture kind={card.picture} width={inner} /> : null}
                  </View>
                  <Text style={[typography.heading, { color: colors.ink, marginTop: spacing.md, alignSelf: 'stretch' }]}>
                    {card.title}
                    {HAND_TAIL}
                  </Text>
                  <Text style={[typography.caption, { color: colors.inkMuted, marginTop: spacing.xs, alignSelf: 'stretch', minHeight: 23 * 3 }]}>{card.body}</Text>
                </View>
              ))}
            </ScrollView>
            {/* Where you are in the deck. */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm }}>
              {cards.map((c, i) => (
                <View key={c.title} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? colors.gilt : withAlpha(colors.ink, 0.2) }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg, paddingTop: spacing.md }}>
              {page > 0 ? <PillButton label="Back" icon="chevron-back" grow onPress={() => go(page - 1)} /> : null}
              <PillButton label={last ? 'Lovely' : 'Next'} icon={last ? 'heart' : 'chevron-forward'} tone="dark" grow onPress={() => (last ? onDone() : go(page + 1))} />
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function Picture({ kind, width }: { kind: WhatsNewPicture; width: number }) {
  switch (kind) {
    case 'cassettes':
      return <CassetteFan width={width} />;
    case 'recording':
      return <RecordingDeck width={Math.min(width, 250)} elapsed={14000} />;
    case 'mailbox':
      return <SealedEnvelope width={width} />;
    case 'people':
      return <People width={width} />;
    case 'widgets':
      return <Widgets width={width} />;
    case 'portrait':
      return <PortraitHop />;
  }
}

/** Three of the six tapes, fanned like they were tipped out of a box. */
function CassetteFan({ width }: { width: number }) {
  const w = Math.min(140, width * 0.44);
  const fan = [
    { id: 'retro', rotate: '-10deg', x: -w * 0.5, y: 14 },
    { id: 'metal', rotate: '9deg', x: w * 0.5, y: 14 },
    { id: 'clear', rotate: '-2deg', x: 0, y: -14 },
  ] as const;
  return (
    <View style={{ width, height: PICTURE_H, alignItems: 'center', justifyContent: 'center' }}>
      {fan.map((f) => (
        <View key={f.id} style={{ position: 'absolute', transform: [{ translateX: f.x }, { translateY: f.y }, { rotate: f.rotate }], boxShadow: '0px 6px 12px rgba(0,0,0,0.25)' }}>
          <Cassette width={w} title="LookBack" detail="C90" played={0.35} style={cassetteStyle(f.id)} />
        </View>
      ))}
    </View>
  );
}

/** A sealed envelope with a wax heart, a postmark and the globe: a page waiting for someone far away. */
function SealedEnvelope({ width }: { width: number }) {
  const { colors } = useTheme();
  const w = Math.min(220, width * 0.8);
  const h = w * 0.62;
  const paper = mixHex(colors.paper, '#FFFFFF', 0.35);
  const edge = mixHex(colors.paper, '#000000', 0.25);
  const seal = w * 0.24;
  return (
    <View style={{ width: w, height: h + 30, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ transform: [{ rotate: '-4deg' }], boxShadow: '0px 8px 16px rgba(0,0,0,0.25)' }}>
        <Svg width={w} height={h}>
          <Rect x={0.5} y={0.5} width={w - 1} height={h - 1} rx={4} fill={paper} stroke={edge} />
          {/* The folds: the bottom flaps meeting, and the top flap closed over them. */}
          <Path d={`M1 ${h - 1} L${w / 2} ${h * 0.5} L${w - 1} ${h - 1}`} stroke={edge} strokeWidth={1} fill="none" />
          <Path d={`M1 1 L${w / 2} ${h * 0.58} L${w - 1} 1 Z`} fill={mixHex(paper, '#000000', 0.05)} stroke={edge} strokeWidth={1} />
          {/* A postmark in the corner. */}
          <Path d={`M${w - 52} 16 h36 M${w - 52} 22 h36 M${w - 52} 28 h36`} stroke={withAlpha(colors.inkBlue, 0.35)} strokeWidth={1.5} />
        </Svg>
        {/* The wax seal where the flap closes, a heart pressed into it. */}
        <View style={{ position: 'absolute', left: w / 2 - seal / 2, top: h * 0.58 - seal / 2, width: seal, height: seal, borderRadius: seal / 2, backgroundColor: colors.wax, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 2px 4px rgba(0,0,0,0.35)', backgroundImage: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 60%)' }}>
          <Ionicons name="heart" size={seal * 0.45} color={withAlpha('#FFFFFF', 0.55)} />
        </View>
      </View>
      <View style={{ position: 'absolute', right: 0, top: 0, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.inkBlue, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '8deg' }] }}>
        <Ionicons name="earth" size={24} color={colors.gilt} />
      </View>
    </View>
  );
}

/** One of the three stand-in friends, picked part by part (gentle, everyday looks; nothing random or exaggerated). */
function friend(parts: { [K in PortraitPart]?: (typeof PORTRAIT_OPTIONS)[K][number] }): Portrait {
  const p = { ...defaultPortrait('friend'), beard: 0, cover: 0, accessory: 0, blush: 0, lashes: 0, film: 2 };
  for (const [part, option] of Object.entries(parts) as [PortraitPart, string][]) {
    const i = (PORTRAIT_OPTIONS[part] as readonly string[]).indexOf(option);
    if (i >= 0) p[part] = i;
  }
  return p;
}
const STAND_INS: Portrait[] = [
  friend({ face: 'oval', skin: '3', eyes: 'almond', eyeColor: 'brown', brows: 'arched', nose: 'small', mouth: 'smile', hair: 'bob', hairColor: 'dark brown', top: 'tee', topColor: 'navy', blush: 'blush' }),
  friend({ face: 'round', skin: '6', eyes: 'round', eyeColor: 'dark brown', brows: 'straight', nose: 'button', mouth: 'grin', hair: 'crop', hairColor: 'black', top: 'hoodie', topColor: 'bottle' }),
  friend({ face: 'heart', skin: '9', eyes: 'almond', eyeColor: 'dark brown', brows: 'arched', nose: 'small', mouth: 'smile', hair: 'long curly', hairColor: 'black', top: 'shirt', topColor: 'plum', accessory: 'earrings', lashes: 'lashes' }),
];

/**
 * Your people as their film portraits, each with how many pages: the person's own people when they have some (their
 * real portraits, as they made them), otherwise three friendly stand-ins.
 */
function People({ width }: { width: number }) {
  const { colors, typography } = useTheme();
  const real = usePeople().filter((p) => p.portrait);
  const size = Math.min(78, (width - 24) / 3);
  const shown = real.length >= 2
    ? real.slice(0, 3).map((p, i) => ({ key: p.id, portrait: portraitFor(p.portrait, p.name), label: p.name, pages: null as number | null, i }))
    : STAND_INS.map((portrait, i) => ({ key: String(i), portrait, label: null as string | null, pages: [12, 3, 7][i]!, i }));
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
      {shown.map((p) => (
        <View key={p.key} style={{ alignItems: 'center', transform: [{ rotate: `${(p.i - 1) * 4}deg` }, { translateY: p.i === 1 ? -10 : 0 }] }}>
          <FilmPortrait portrait={p.portrait} size={size} hole={colors.panel} />
          <Text numberOfLines={1} style={[typography.handSmall, { color: colors.inkMuted, textAlign: 'center', width: size + 20, marginTop: 4 }]}>
            {p.label ?? `${p.pages} pages`}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Your own portrait in its film, with the little you hopped out beside it, smiling. */
function PortraitHop() {
  const { colors } = useTheme();
  const { data: profile } = useProfile();
  if (!profile) return null;
  const me = portraitFor(profile.portrait, profile.name);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
      <View style={{ transform: [{ rotate: '-4deg' }] }}>
        <FilmPortrait portrait={me} size={150} hole={colors.panel} face="wow" />
      </View>
      <View style={{ borderRadius: 40, boxShadow: '0px 6px 12px rgba(0,0,0,0.25)', transform: [{ rotate: '6deg' }] }}>
        <PortraitSticker portrait={me} size={80} face="joy" />
      </View>
    </View>
  );
}

/** The two widgets, as they look in the phone's widget list. */
function Widgets({ width }: { width: number }) {
  const w = Math.min(160, (width - 12) / 2);
  return (
    <View style={{ width, height: PICTURE_H, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={WIDGET_TODAY} style={{ position: 'absolute', width: w, height: w * 0.75, transform: [{ translateX: -w * 0.42 }, { translateY: -22 }, { rotate: '-5deg' }] }} contentFit="contain" />
      <Image source={WIDGET_PERSON} style={{ position: 'absolute', width: w, height: w * 0.75, transform: [{ translateX: w * 0.42 }, { translateY: 26 }, { rotate: '4deg' }] }} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
