import { Tabs } from 'expo-router';
import { PageActiveGate } from '../../components/PageActive';
import { useTheme } from '../../theme';

/**
 * Home, Years and Settings: the pages the bar at the bottom switches between. As tabs they are built
 * once and kept, so switching is a quick cross-fade between pages that already exist (as a stack, every
 * switch rebuilt the whole page mid-slide). The bar itself is our own NavBar, drawn by the root layout.
 */
export default function TabsLayout() {
  const { colors, motion } = useTheme();
  return (
    <Tabs
      tabBar={() => null}
      // Keep hidden pages attached: re-attaching one redraws it from scratch (its cupboard textures too),
      // which cost a 230 ms frame on every switch.
      detachInactiveScreens={false}
      // Hidden pages pause their endless animations (see PageActive).
      screenLayout={({ children }) => <PageActiveGate>{children}</PageActiveGate>}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        transitionSpec: { animation: 'timing', config: { duration: motion.tabFadeMs } },
        sceneStyle: { backgroundColor: colors.desk },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="years" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
