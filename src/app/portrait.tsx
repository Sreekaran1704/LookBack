import { router } from 'expo-router';
import { memo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { DiaryDock } from '../components/DiaryDock';
import { PortraitBuddy, usePortraitFace, usePortraitHop } from '../components/PortraitBuddy';
import { PortraitChoices } from '../components/PortraitChoices';
import { PageFooter, PageHeader, usePageContentStyle } from '../components/Screen';
import { useStatusPill } from '../components/StatusPill';
import { FilmPortrait } from '../components/scrapbook/FilmPortrait';
import { PaperBackground } from '../components/scrapbook/PaperBackground';
import { settingsRepository } from '../data';
import { useProfile } from '../hooks/useData';
import { encodePortrait, portraitFor, randomPortrait, type Portrait } from '../lib/portrait';
import { useTheme } from '../theme';

/** How tall the big portrait is at the top of the page. */
const PREVIEW_H = 190;

/**
 * The portrait maker: your portrait big at the top, in its film frame, and under it the choices in a few tabs, one
 * sideways row per part, each open to everyone. Scroll down and the little you hops out of the film to the bottom
 * right, pulling a face at each change, so you always see what you just picked. It's saved to your profile and goes with the pages you give,
 * so your people see you as you made yourself. Back leaves it as it was; Surprise me rolls a whole new one.
 */
function PortraitScreen() {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const pageContent = usePageContentStyle({ thumbBar: true });
  const insets = useSafeAreaInsets();
  const statusPill = useStatusPill();
  const { data: profile } = useProfile();
  // Your changes so far; until the first one, your saved portrait (or the one your name would give you).
  const [edits, setDraft] = useState<Portrait | null>(null);
  const draft = edits ?? (profile ? portraitFor(profile.portrait, profile.name) : null);
  const { filmRef, onScroll, out } = usePortraitHop();
  const { face } = usePortraitFace(draft);
  const save = async () => {
    if (!draft) return;
    await settingsRepository.setProfile({ portrait: encodePortrait(draft) });
    statusPill.show('Your portrait is saved');
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <View style={{ flex: 1 }}>
        <Animated.ScrollView style={{ flex: 1 }} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={[pageContent, { paddingTop: insets.top + spacing.lg }]}>
          <PageHeader title="Your portrait" subtitle="how your people will see you" accent={colors.gilt} buddy={false} />
          <Animated.View ref={filmRef} collapsable={false} style={{ alignSelf: 'center', paddingBottom: spacing.md }}>
            {draft ? <FilmPortrait portrait={draft} size={PREVIEW_H} hole={colors.desk} face={face} /> : <View style={{ height: PREVIEW_H }} />}
          </Animated.View>
          {draft ? <PortraitChoices value={draft} onChange={setDraft} /> : null}
          <PageFooter label="you · your portrait" />
        </Animated.ScrollView>
        {/* Once the film has scrolled away, the little you sits here, beside the choices. */}
        {draft ? <PortraitBuddy portrait={draft} out={out} /> : null}
      </View>
      <DiaryDock
        actions={[
          { key: 'back', label: 'Back', icon: 'chevron-back', onPress: () => router.back() },
          { key: 'surprise', label: 'Surprise', icon: 'shuffle', accessibilityLabel: 'Surprise me: a whole new portrait', onPress: () => setDraft(randomPortrait()) },
          { key: 'save', label: 'Save', icon: 'checkmark', primary: colors.gilt, onPress: () => void save() },
        ]}
      />
    </View>
  );
}

export default memo(PortraitScreen, () => true);
