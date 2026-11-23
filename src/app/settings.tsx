import Constants from 'expo-constants';
import { router } from 'expo-router';
import { memo } from 'react';
import { Alert, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { DiaryDock } from '../components/DiaryDock';
import { ActionRow, CardTitle, Help, Row } from '../components/CardParts';
import { PageFooter, PageHeader, Panel, usePageContentStyle } from '../components/Screen';
import { useStatusPill } from '../components/StatusPill';
import { PaperBackground } from '../components/scrapbook/PaperBackground';
import { cycleAppIcon } from '../device/appIcon';
import { clearSampleEntries, seedSampleEntries } from '../dev/seed';
import { useToday } from '../hooks/useData';
import { parseLocalDate } from '../lib/dates';
import { SHOW_DEV_TOOLS } from '../lib/flags';
import { sendTestNotification } from '../notifications/scheduler';
import { useTheme, type YearPalette } from '../theme';

/**
 * Settings, the last page of the diary: about the diary (and the developer tools). The look, reminders, your name,
 * your Google account and backup are on the You page, each with its controls and a line of help inside it, so nothing floats loose.
 */
function SettingsScreen() {
  const theme = useTheme();
  const pageContent = usePageContentStyle({ thumbBar: true });
  const palette = theme.year(parseLocalDate(useToday()).year);

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <Animated.ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={pageContent}>
        <PageHeader title="Settings" subtitle="make this diary yours" accent={palette.secondary} />

        <AboutCard palette={palette} />
        {SHOW_DEV_TOOLS ? <DeveloperCard palette={palette} /> : null}

        <PageFooter label="the last page · settings" />
      </Animated.ScrollView>
      <DiaryDock actions={[{ key: 'back', label: 'Back', icon: 'chevron-back', onPress: () => router.back() }]} />
    </View>
  );
}

/** Private backup to the person's own Google Drive: connect an account, back up, see when it last ran. */
function AboutCard({ palette }: { palette: YearPalette }) {
  const { colors, typography } = useTheme();
  return (
    <Panel seed="about" accent={palette.primary} accent2={palette.secondary}>
      <CardTitle icon="book-outline" title="About" color={palette.primary} />
      <Row label="LookBack">
        <Text style={[typography.handSmall, { color: colors.inkMuted }]}>version {Constants.expoConfig?.version ?? '1.0'}</Text>
      </Row>
      <ActionRow label="Read the first page again" divider onPress={() => router.push('/welcome')} />
      <Help>Write what weighs on you. It comes back to you on the same day next year, so you can see how it feels now.</Help>
    </Panel>
  );
}

function DeveloperCard({ palette }: { palette: YearPalette }) {
  const statusPill = useStatusPill();
  return (
    <Panel seed="developer" accent={palette.primary} accent2={palette.secondary}>
      <CardTitle icon="construct-outline" title="Developer" />
      <ActionRow label="Seed sample memories" onPress={async () => statusPill.show(`Added ${await seedSampleEntries()} sample memories`)} />
      <ActionRow divider label="Clear sample memories" onPress={async () => statusPill.show(`Removed ${await clearSampleEntries()} sample memories`)} />
      <ActionRow divider label="Next icon mood" onPress={async () => statusPill.show(`Icon: ${await cycleAppIcon()} (see your app drawer)`)} />
      <ActionRow
        divider
        label="Send test notification"
        onPress={async () => {
          const ok = await sendTestNotification();
          if (ok) statusPill.show('Test notification in 3 seconds');
          else Alert.alert('Notifications are off', 'Allow notifications to test reminders.');
        }}
      />
    </Panel>
  );
}


// Memoised, ignoring props (it was a bar page; it now opens from You): the page slider re-renders every page when the route changes, and the first time the bar
// opens a page the router hands it a new route object, which rebuilt the whole page once (Settings: 90 ms, the stutter at
// the end of the first swipe to it). The page reads everything it needs through hooks, so its props never matter.
export default memo(SettingsScreen, () => true);
