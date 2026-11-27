import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { IconName } from '../../components/Buttons';
import { Composer, MessageMenu, ReactionChips, SnippetSheet, VoiceBubble, type SnippetBubble } from '../../components/Chat';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { DiaryDock } from '../../components/DiaryDock';
import { PersonSeal } from '../../components/PersonSeal';
import { PressableScale } from '../../components/PressableScale';
import { PageFooter, PageHeader, usePageContentStyle } from '../../components/Screen';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { useStatusPill } from '../../components/StatusPill';
import { entriesRepository } from '../../data';
import { sharingRepository } from '../../data/sharingRepository';
import { deleteForEveryone, deleteForMe, seeChat, sendChat } from '../../data/social/postman';
import { useAppOpen } from '../../hooks/useAppOpen';
import { useAllEntries, useProfile, useToday } from '../../hooks/useData';
import { useGivenPages, useGonePeople, useMessages, useOutbox, usePeople, useReactions, useReceivedLetters } from '../../hooks/useSharing';
import { canUnsend, chatUnlocked, reactionsOn } from '../../lib/chat';
import { formatDisplayDate, toLocalDate } from '../../lib/dates';
import { groupByPerson } from '../../lib/sharedPeople';
import { mixHex, useTheme, withAlpha } from '../../theme';

const fileUri = (path: string | null) => (path ? sharingRepository.fileUri(path) : null);
const SEAL = 48;
const THUMB = 56;

/**
 * Your chat with one friend (opened from Chat, growing out of their row like an app opening): their portrait at the
 * top right (tap it for their profile page, /friend/[id]), then pages and messages back and forth in one thread,
 * oldest at the top, theirs left on paper and yours right in gilt. The message box (text, or the mic) opens once a page
 * has passed between you. Long press anything to react, select bubbles to quote a picture of them into today's page,
 * or delete a message (for you, or for everyone until they've seen it). Memories in the bar hides the words and shows
 * only the pages you've given each other, bigger and warmer.
 */
export default function PersonScreen() {
  const { id, x, y } = useLocalSearchParams<{ id: string; x?: string; y?: string }>();
  // Opens like an app on a Samsung phone: out of the row you tapped; the thread is built once it has opened.
  const open = useAppOpen({ x, y });
  const theme = useTheme();
  const { colors, typography, spacing } = theme;
  const content = usePageContentStyle({ thumbBar: true });
  const people = usePeople();
  const letters = useReceivedLetters();
  const outbox = useOutbox();
  const gone = useGonePeople();
  const given = useGivenPages(id);
  const messages = useMessages(id);
  const reactions = useReactions();
  const { data: entries } = useAllEntries();
  const { data: profile } = useProfile();
  const today = useToday();
  const statusPill = useStatusPill();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [memoryMode, setMemoryMode] = useState(false);
  const [menu, setMenu] = useState<Item | null>(null);
  /** One tap on a message: just the reactions. A long press: the other options (menu). */
  const [reactFor, setReactFor] = useState<Item | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [snippet, setSnippet] = useState<SnippetBubble[] | null>(null);
  const [replacePhoto, setReplacePhoto] = useState<string | null>(null);
  const [problem, setProblem] = useState('');
  // Looking at the chat: their new messages are read, and their phone hears they've been seen.
  useEffect(() => {
    if (messages.some((m) => !m.mine && m.state === 'new')) void seeChat(id);
  }, [messages, id]);

  const group = groupByPerson(people, letters).find((g) => g.id === id) ?? null;
  const person = group?.person ?? null;
  const name = group?.name ?? 'Someone';
  const myName = profile?.name || 'me';
  const waiting = outbox.filter((o) => o.personId === id).length;
  const notFriends = !!person && !person.friends;
  const canChat = !!person?.friends && chatUnlocked(group?.letters.length ?? 0, given.length);
  const fail = (e: unknown) => setProblem(e instanceof Error ? e.message : String(e));

  // One thread, both ways, in the order they happened.
  const pages: Item[] = [
    ...(group?.letters ?? []).map(
      (l): Item => ({
        key: `in-${l.id}`,
        target: l.id,
        kind: 'page',
        mine: false,
        at: l.receivedAt,
        date: l.memoryDate,
        line: l.body.split('\n')[0] || l.voiceTitle || (l.photoPath ? 'a photo' : 'a recording'),
        photo: fileUri(l.photoPath),
        voiceUri: null,
        voiceWave: null,
        voiceMs: null,
        hasVoice: !!l.voicePath,
        unread: !l.openedAt,
        foot: formatDisplayDate(toLocalDate(new Date(l.receivedAt))),
        icon: null,
        iconOn: false,
        state: 'page',
        label: `Open the page ${name} gave you, from ${formatDisplayDate(l.memoryDate)}`,
        open: () => router.push(`/letter/${l.id}`),
      }),
    ),
    ...given.map((g): Item => {
      const entry = entries?.find((e) => e.id === g.entryId) ?? null;
      const date = entry?.localDate ?? g.memoryDate;
      const how = { waiting: 'on its way', sealed: 'sealed, waiting for them', kept: 'they have it', declined: 'they said not now', returned: 'goes when you are both online' }[g.state];
      return {
        key: `out-${g.id}`,
        target: g.id,
        kind: 'page',
        mine: true,
        at: g.givenAt,
        date,
        line: entry ? entry.text.split('\n')[0] || (entry.photoPath ? 'a photo' : 'a recording') : 'no longer in your diary',
        photo: fileUri(entry?.photoPath ?? null),
        voiceUri: null,
        voiceWave: null,
        voiceMs: null,
        hasVoice: !!entry?.voicePath,
        unread: false,
        foot: `${formatDisplayDate(toLocalDate(new Date(g.givenAt)))} · ${how}`,
        icon: ({ waiting: 'time-outline', sealed: 'mail-outline', kept: 'checkmark-done', declined: 'close-circle-outline', returned: 'time-outline' } as const)[g.state],
        iconOn: g.state === 'kept',
        state: 'page',
        label: `Open your page from ${date ? formatDisplayDate(date) : 'that day'}`,
        open: entry ? () => router.push(`/memory/${entry.id}`) : null,
      };
    }),
  ];
  const ticks: Partial<Record<string, IconName>> = { sending: 'time-outline', sent: 'mail-outline', delivered: 'checkmark-done', seen: 'eye-outline', returned: 'time-outline' };
  const chat: Item[] = messages.map((m) => ({
    key: `msg-${m.id}`,
    target: m.id,
    kind: m.kind === 'voice' ? 'voice' : 'text',
    mine: m.mine,
    at: m.at,
    date: null,
    line: m.body,
    photo: null,
    voiceUri: fileUri(m.voicePath),
    voiceWave: m.voiceWave,
    voiceMs: m.voiceMs,
    hasVoice: m.kind === 'voice',
    unread: false,
    foot: new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    icon: m.mine ? (ticks[m.state] ?? null) : null,
    iconOn: m.state === 'seen',
    state: m.state,
    label: m.kind === 'voice' ? 'A voice message' : m.body,
    open: null,
  }));
  const thread = [...pages, ...(memoryMode ? [] : chat)].sort((a, b) => a.at.localeCompare(b.at));

  const subtitle = memoryMode
    ? 'just your memories together'
    : !group
      ? 'not on this phone any more'
      : gone.has(id)
        ? 'their account is gone · add them again'
        : notFriends
          ? "hasn't added you back yet · pages go once they do"
          : canChat
            ? `${person?.best ? '❤️ best friends · ' : ''}${pages.length === 1 ? 'one page' : `${pages.length} pages`} between you${waiting ? ` · ${waiting} on the way` : ''}`
            : 'give them a page to start your chat';

  const toggle = (it: Item) => setPicked((p) => (p.includes(it.key) ? p.filter((k) => k !== it.key) : [...p, it.key]));
  const stopSelecting = () => {
    setSelecting(false);
    setPicked([]);
  };
  const openSnippet = () => {
    const chosen = thread.filter((t) => picked.includes(t.key));
    if (!chosen.length) return;
    setSnippet(
      chosen.map((t) => ({
        key: t.key,
        mine: t.mine,
        who: t.mine ? myName : name,
        text: t.kind === 'text' ? t.line : null,
        voiceMs: t.voiceMs,
        voiceWave: t.voiceWave,
        page: t.kind === 'page' ? { date: t.date ? formatDisplayDate(t.date) : 'a page', line: t.line, photo: t.photo } : null,
        time: formatDisplayDate(toLocalDate(new Date(t.at))),
      })),
    );
  };
  // The picture of the picked bubbles becomes today's page's photo (asking first if one is there).
  const saveSnippet = async (uri: string, replace: boolean) => {
    try {
      const existing = await entriesRepository.getByDate(today);
      if (existing?.photoPath && !replace) {
        setReplacePhoto(uri);
        return;
      }
      await entriesRepository.saveForDate({ localDate: today, text: existing?.text ?? '', photo: { kind: 'set', sourceUri: uri } });
      setSnippet(null);
      setReplacePhoto(null);
      stopSelecting();
      statusPill.show("Added to today's memory");
    } catch (e) {
      fail(e);
    }
  };

  const best = !!person?.best;
  return (
    <Animated.View style={open.style} onLayout={open.onLayout} renderToHardwareTextureAndroid={open.layer} needsOffscreenAlphaCompositing={false}>
      <PaperBackground variant="dots" desk />
      {/* Memory mode: the page warms, like lamplight on old photos. */}
      {memoryMode ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: withAlpha(colors.gilt, 0.14) }} /> : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          ref={scroller}
          style={{ flex: 1 }}
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        >
          <PageHeader
            title={memoryMode ? `You & ${name}` : name}
            subtitle={subtitle}
            accent={colors.gilt}
            buddy={false}
            emblem={
              group ? (
                <PressableScale
                  onPress={(e) => router.push({ pathname: '/friend/[id]', params: { id, x: String(Math.round(e.nativeEvent.pageX)), y: String(Math.round(e.nativeEvent.pageY)) } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${name}'s profile`}
                >
                  <View>
                    {/* The film portrait is an SVG (painted on the CPU): a plain frame stands in until the page has opened. */}
                    {open.ready ? <PersonSeal name={group.name} portrait={group.portrait} size={SEAL} hole={colors.desk} /> : <View style={{ width: (SEAL * 64) / 78, height: SEAL, borderRadius: 2, backgroundColor: colors.ink }} />}
                    {best ? <Text style={{ position: 'absolute', right: -6, bottom: -4, fontSize: 16 }}>❤️</Text> : null}
                  </View>
                </PressableScale>
              ) : null
            }
          />

          {!open.ready ? null : thread.length ? (
            <View style={{ gap: memoryMode ? spacing.xl : spacing.md }}>
              {thread.map((it, i) =>
                memoryMode ? (
                  <PressableScale key={it.key} onPress={it.open ?? undefined} disabled={!it.open} accessibilityRole="button" accessibilityLabel={it.label}>
                    <MemoryCard item={it} tilt={i % 2 ? 2.5 : -2.5} who={it.mine ? myName : name} />
                  </PressableScale>
                ) : (
                  <View key={it.key}>
                    <Bubble
                      mine={it.mine}
                      label={it.label}
                      picked={selecting ? picked.includes(it.key) : null}
                      // One tap: a page opens, a message gets the reaction bar. Long press: add to today's memory, delete.
                      onPress={selecting ? () => toggle(it) : (it.open ?? (person?.friends ? () => setReactFor(it) : null))}
                      onLongPress={selecting ? null : () => setMenu(it)}
                    >
                      {it.kind === 'text' ? (
                        <Text style={[typography.hand, { color: colors.ink, fontSize: 19, lineHeight: 24 }]}>{it.line}</Text>
                      ) : it.kind === 'voice' ? (
                        <VoiceBubble uri={it.voiceUri} wave={it.voiceWave} ms={it.voiceMs} />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <MemoryTile item={it} size={THUMB} />
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={[typography.print, { color: colors.ink, fontWeight: it.unread ? '700' : '400' }]}>
                              {it.date ? formatDisplayDate(it.date) : 'a page'}
                            </Text>
                            <Text numberOfLines={2} style={[typography.hand, { color: colors.inkBlue, fontSize: 18, lineHeight: 22 }]}>
                              {it.line}
                            </Text>
                          </View>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
                        <Text numberOfLines={1} style={[typography.caption, { color: colors.inkMuted, fontSize: 13, lineHeight: 17, flex: 1, textAlign: 'right' }]}>
                          {it.foot}
                        </Text>
                        {it.icon ? <Ionicons name={it.icon} size={15} color={it.iconOn ? colors.gilt : colors.inkMuted} /> : null}
                        {it.unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.sepia }} /> : null}
                      </View>
                    </Bubble>
                    <ReactionChips
                      mine={it.mine}
                      reactions={reactionsOn(it.target, reactions)}
                      // Tap your reaction to take it away.
                      onRemoveMine={person?.friends ? () => sendChat(id, { kind: 'react', target: it.target, emoji: '' }).catch(fail) : undefined}
                    />
                  </View>
                ),
              )}
            </View>
          ) : group ? (
            <Text style={[typography.caption, { color: colors.onDeskMuted, textAlign: 'center', alignSelf: 'stretch' }]}>
              {memoryMode ? 'No memories between you yet.' : 'Give them a page and your chat starts here: theirs on the left, yours on the right.'}
            </Text>
          ) : null}
          {problem ? (
            <Text accessibilityRole="alert" style={[typography.print, { color: colors.onDesk }]}>
              {problem}
            </Text>
          ) : null}
          <PageFooter label={`chat · ${name}`} />
        </ScrollView>
        <DiaryDock
          actions={
            selecting
              ? [
                  { key: 'cancel', label: 'Cancel', icon: 'close', onPress: stopSelecting },
                  { key: 'quote', label: picked.length ? `Add ${picked.length}` : 'Add', icon: 'bookmark-outline', primary: colors.gilt, accessibilityLabel: "Add the picked ones to today's memory", onPress: openSnippet },
                ]
              : [
                  { key: 'back', label: 'Back', icon: 'chevron-back', onPress: open.close },
                  {
                    key: 'memories',
                    label: 'Memories',
                    icon: memoryMode ? 'images' : 'images-outline',
                    active: memoryMode,
                    accessibilityLabel: memoryMode ? 'Back to the chat' : 'Memory mode: only the pages you shared',
                    onPress: () => setMemoryMode((v) => !v),
                  },
                ]
          }
        >
          {/* The message box, once a page has passed between you (and you're friends). */}
          {/* (Built after the page has opened: its text box and recorder are the heaviest part of the first frame.) */}
          {open.ready && canChat && !selecting && !memoryMode ? (
            <Composer onSendText={(text) => sendChat(id, { kind: 'text', text }).catch(fail)} onSendVoice={(v) => sendChat(id, { kind: 'voice', uri: v.uri, ms: v.ms, wave: v.wave }).catch(fail)} />
          ) : null}
        </DiaryDock>
      </KeyboardAvoidingView>
      {/* One tap on a message: react. */}
      <MessageMenu
        visible={!!reactFor}
        current={reactFor ? (reactionsOn(reactFor.target, reactions).find((r) => r.from === 'me')?.emoji ?? null) : null}
        onReact={(emoji: string) => {
          const target = reactFor?.target;
          setReactFor(null);
          if (target) sendChat(id, { kind: 'react', target, emoji }).catch(fail);
        }}
        onSelect={null}
        onDeleteMe={null}
        onDeleteAll={null}
        onClose={() => setReactFor(null)}
      />
      {/* A long press: add to today's memory, delete (a page, which opens on a tap, gets its reactions here too). */}
      <MessageMenu
        visible={!!menu}
        current={menu ? (reactionsOn(menu.target, reactions).find((r) => r.from === 'me')?.emoji ?? null) : null}
        onReact={
          person?.friends && menu?.kind === 'page'
            ? (emoji: string) => {
                const target = menu.target;
                setMenu(null);
                sendChat(id, { kind: 'react', target, emoji }).catch(fail);
              }
            : null
        }
        onSelect={() => {
          const first = menu?.key;
          setMenu(null);
          setSelecting(true);
          setPicked(first ? [first] : []);
        }}
        onDeleteMe={
          menu && menu.kind !== 'page'
            ? () => {
                const target = menu.target;
                setMenu(null);
                deleteForMe(target).catch(fail);
              }
            : null
        }
        onDeleteAll={
          menu && menu.kind !== 'page' && canUnsend({ mine: menu.mine, state: menu.state })
            ? () => {
                const target = menu.target;
                setMenu(null);
                deleteForEveryone(id, target).catch(fail);
              }
            : null
        }
        onClose={() => setMenu(null)}
      />
      <SnippetSheet
        visible={snippet !== null && replacePhoto === null}
        title={`${name} & ${myName}`}
        bubbles={snippet ?? []}
        onAdd={(b64: string) => {
          sharingRepository
            .saveSnapshot(b64)
            .then((uri) => saveSnippet(uri, false))
            .catch(fail);
        }}
        onClose={() => setSnippet(null)}
      />
      <ConfirmSheet
        visible={replacePhoto !== null}
        title="Today's page has a photo"
        message="Put these there instead? The photo on today's page is replaced."
        confirmLabel="Replace it"
        confirmIcon="image-outline"
        onConfirm={() => {
          if (replacePhoto) void saveSnippet(replacePhoto, true);
        }}
        onCancel={() => setReplacePhoto(null)}
      />
    </Animated.View>
  );
}

interface Item {
  key: string;
  /** What a reaction is on: the page's gift id or the message's id (the same on both phones). */
  target: string;
  kind: 'page' | 'text' | 'voice';
  mine: boolean;
  at: string;
  date: string | null;
  line: string;
  photo: string | null;
  voiceUri: string | null;
  voiceWave: number[] | null;
  voiceMs: number | null;
  hasVoice: boolean;
  unread: boolean;
  foot: string;
  icon: IconName | null;
  iconOn: boolean;
  /** A message's state (for delete for everyone), or 'page'. */
  state: string;
  label: string;
  open: (() => void) | null;
}

/** A page as a little square: its photo, or paper with a page or tape icon. */
function MemoryTile({ item, size }: { item: Item; size: number }) {
  const { colors } = useTheme();
  return item.photo ? (
    <Image source={{ uri: item.photo }} style={{ width: size, height: size, borderRadius: 6 }} contentFit="cover" />
  ) : (
    <View style={{ width: size, height: size, borderRadius: 6, backgroundColor: withAlpha(colors.ink, 0.07), alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={item.hasVoice ? 'recording-outline' : 'document-text-outline'} size={size * 0.4} color={colors.inkMuted} />
    </View>
  );
}

/** Memory mode: a page as a big, softly tilted keepsake card (the photo or its words, the day, who gave it). */
function MemoryCard({ item, tilt, who }: { item: Item; tilt: number; who: string }) {
  const theme = useTheme();
  const { colors, typography, spacing } = theme;
  return (
    <View
      style={{
        width: '86%',
        alignSelf: item.mine ? 'flex-end' : 'flex-start',
        padding: spacing.md,
        paddingBottom: spacing.lg,
        borderRadius: 6,
        backgroundColor: mixHex(colors.panel, colors.gilt, item.mine ? 0.18 : 0.06),
        transform: [{ rotate: `${tilt}deg` }],
        boxShadow: theme.shadow(undefined, 2),
        gap: spacing.sm,
      }}
    >
      {item.photo ? (
        <Image source={{ uri: item.photo }} style={{ width: '100%', aspectRatio: 1, borderRadius: 3 }} contentFit="cover" />
      ) : (
        <Text numberOfLines={6} style={[typography.hand, { color: colors.inkBlue, fontSize: 22, lineHeight: 29 }]}>
          {item.line}
        </Text>
      )}
      <Text style={[typography.hand, { color: colors.ink, fontSize: 19, lineHeight: 24, textAlign: 'center', alignSelf: 'stretch' }]}>
        {`${item.date ? formatDisplayDate(item.date) : 'a page'} · from ${who} `}
      </Text>
    </View>
  );
}

/**
 * One thing in the thread, as a chat bubble: theirs on the left on plain paper with its corner tucked in at the bottom
 * left, yours on the right washed in gilt with its corner tucked in at the bottom right. Paper stays light, so the
 * words are ink in both tones.
 */
function Bubble({ mine, onPress, onLongPress, picked, label, children }: { mine: boolean; onPress: (() => void) | null; onLongPress: (() => void) | null; picked: boolean | null; label: string; children: ReactNode }) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const body = (
    <View
      style={{
        padding: spacing.sm,
        borderRadius: 16,
        borderBottomLeftRadius: mine ? 16 : 4,
        borderBottomRightRadius: mine ? 4 : 16,
        backgroundColor: mine ? mixHex(colors.panel, colors.gilt, 0.32) : colors.panel,
        borderWidth: picked ? 2 : 1,
        borderColor: picked ? colors.ink : mine ? withAlpha(colors.gilt, 0.55) : withAlpha(colors.ink, 0.12),
        boxShadow: theme.shadow(undefined, 1),
      }}
    >
      {children}
      {/* Picking bubbles to quote: a tick in the corner. */}
      {picked !== null ? (
        <View style={{ position: 'absolute', top: -8, [mine ? 'left' : 'right']: -8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: picked ? colors.ink : colors.panel, borderWidth: 1, borderColor: colors.ink }}>
          {picked ? <Ionicons name="checkmark" size={14} color={colors.panel} /> : null}
        </View>
      ) : null}
    </View>
  );
  return (
    <View style={{ width: '82%', alignSelf: mine ? 'flex-end' : 'flex-start' }}>
      {onPress || onLongPress ? (
        <PressableScale onPress={onPress ?? undefined} onLongPress={onLongPress ?? undefined} delayLongPress={350} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Long press to add it to today's memory or delete it">
          {body}
        </PressableScale>
      ) : (
        body
      )}
    </View>
  );
}
