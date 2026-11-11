import { Caveat_500Medium, Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BookFlightProvider } from '../components/BookFlight';
import { Intro } from '../components/Intro';
import { NavBar, NavBarProvider } from '../components/NavBar';
import { preloadBuddy } from '../components/scrapbook/Buddy';
import { StatusPillProvider } from '../components/StatusPill';
import { preloadLook, ThemeProvider } from '../components/ThemeProvider';
import { syncAppIcon } from '../device/appIcon';
import { backupRepository, entriesRepository, settingsRepository } from '../data';
import { preloadEntries, useAllEntries, useToday } from '../hooks/useData';
import { configureNotifications, refreshReminders } from '../notifications/scheduler';
import { useTheme } from '../theme';
import { refreshWidget } from '../widget';

/** How long the native splash takes to fade into the intro (the intro waits for it before moving). */
const SPLASH_FADE_MS = 150;

// The native splash (the bunny) stays up until the intro, which starts from the same picture, is on screen.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
// A quick fade: the intro's bunny sits exactly where the splash bunny was, and only starts moving after this.
SplashScreen.setOptions({ duration: SPLASH_FADE_MS, fade: true });

/** Background work (reminders, backup) waits until the intro has finished, so it can't cost frames there. */
const DEFER_STARTUP_WORK_MS = 3000;

function refresh() {
  refreshReminders().catch((error: unknown) => console.warn('[reminders] refresh failed', error));
}

/** Opened straight onto another page (the widget's "+ add today", a notification), home is still underneath, so Back goes home. */
export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Caveat_500Medium,
    Caveat_600SemiBold,
    Caveat_700Bold,
  });
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await entriesRepository.count(); // opens + migrates the database
        // Every entry goes into memory now, so the home screen and the intro have them in their first frame.
        // The bunny's pictures are decoded now too, so it is on screen in the intro's first frame.
        // The paper look too, so the first frame is already on the person's own paper.
        await Promise.all([preloadEntries(), preloadLook(), configureNotifications(), preloadBuddy().catch(() => undefined)]);
        if (!cancelled) setReady(true);
        setTimeout(() => {
          refresh();
          backupRepository.syncIfDue(); // quiet daily backup when connected; never throws
        }, DEFER_STARTUP_WORK_MS);
      } catch (error) {
        if (!cancelled) setStartupError(error instanceof Error ? error.message : String(error));
      }
    })();

    // Rolling notification window: refresh on app open and after every data change.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
        backupRepository.syncIfDue();
      } else if (state === 'background') {
        // The icon's bunny changes mood only while the app is closed (see device/appIcon).
        syncAppIcon();
      }
    });
    // Tapping a memory notification opens the home page, where today's letters are waiting.
    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      const kind = response.notification.request.content.data?.kind;
      if (kind === 'memory' || kind === 'test') router.navigate('/');
    });
    const unsubEntries = entriesRepository.subscribe(() => {
      refresh();
      refreshWidget();
    });
    const unsubSettings = settingsRepository.subscribe(() => {
      refresh();
      refreshWidget(); // the widget is drawn on the chosen paper
    });
    return () => {
      cancelled = true;
      appState.remove();
      tapped.remove();
      unsubEntries();
      unsubSettings();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <AppShell loading={(!fontsLoaded && !fontError) || !ready} error={startupError} />
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function AppShell({ loading, error }: { loading: boolean; error: string | null }) {
  const theme = useTheme();
  const { colors, motion } = theme;
  const [showIntro, setShowIntro] = useState(true);
  // First run: once the intro has lifted, the bunny asks its few questions.
  useEffect(() => {
    if (showIntro || loading) return;
    settingsRepository.getOnboarded().then((done) => {
      if (!done) router.push('/welcome');
    }, () => undefined);
  }, [showIntro, loading]);
  const { data: entries = [] } = useAllEntries();
  const today = useToday();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.desk).catch(() => undefined);
  }, [colors.desk]);

  useEffect(() => {
    if (error) SplashScreen.hideAsync().catch(() => undefined);
  }, [error]);

  // Theme switch: the previous desk color fades out over the new one.
  const previousDesk = useRef(colors.desk);
  const [fadeFrom, setFadeFrom] = useState<string | null>(null);
  const fade = useSharedValue(0);
  useEffect(() => {
    if (previousDesk.current === colors.desk) return;
    setFadeFrom(previousDesk.current);
    previousDesk.current = colors.desk;
    fade.set(1);
    fade.set(withTiming(0, { duration: motion.lampFadeMs }));
  }, [colors.desk, fade, motion.lampFadeMs]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.desk, padding: theme.spacing.gutter }]}>
        <Text style={[theme.typography.body, { color: colors.onDesk }]}>
          Something went wrong opening your memories.{'\n'}
          {error}
        </Text>
      </View>
    );
  }
  // The native splash is still showing while fonts and the database load.
  if (loading) return <View style={[styles.center, { backgroundColor: colors.desk }]} />;

  return (
    <StatusPillProvider>
      <BookFlightProvider>
      <NavBarProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.desk },
          animation: 'slide_from_right',
          animationDuration: motion.screenMs,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="entry" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        {/* Opens hidden under the diary's page (BookFlight), which then fades away; going back fades too. */}
        <Stack.Screen name="year/[year]" options={{ animation: 'fade', animationDuration: 1 }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
      <NavBar />
      </NavBarProvider>
      {fadeFrom ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fadeFrom }, fadeStyle]} />
      ) : null}
      {/* The home screen renders underneath while the intro plays, so it is ready the moment the sheet lifts. */}
      {showIntro ? <Intro entries={entries} today={today} onDone={() => setShowIntro(false)} /> : null}
      </BookFlightProvider>
    </StatusPillProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
});
