import { router } from 'expo-router';
import { memo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { DiaryDock } from '../components/DiaryDock';
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
 * The portrait maker: your portrait big at the top, in its film frame, and under it one sideways row of choices per
 * part (skin, face, build, hair…), each open to everyone. It's saved to your profile and goes with the pages you give,
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
  const save = async () => {
    if (!draft) return;
    await settingsRepository.setProfile({ portrait: encodePortrait(draft) });
    statusPill.show('Your portrait is saved');
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      {/* The portrait stays in view while you scroll through the choices under it. */}
      <View style={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.gutter }}>
        <PageHeader title="Your portrait" subtitle="how your people will see you" accent={colors.gilt} buddy={false} />
        <View style={{ alignItems: 'center', paddingBottom: spacing.md }}>
          {draft ? <FilmPortrait portrait={draft} size={PREVIEW_H} hole={colors.desk} /> : <View style={{ height: PREVIEW_H }} />}
        </View>
      </View>
      <Animated.ScrollView style={{ flex: 1 }} contentContainerStyle={[pageContent, { paddingTop: spacing.xs }]}>
        {draft ? <PortraitChoices value={draft} onChange={setDraft} /> : null}
        <PageFooter label="you · your portrait" />
      </Animated.ScrollView>
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
