import { type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PaperTabs } from './PaperTabs';
import type { BarAction } from './Screen';

/**
 * A page's own buttons (a memory's Back · Listen · Turn over · Delete, a year's Back · Tidy up), as paper index tabs on
 * the page's bottom edge, the same as the tabs on the main pages. Anything in `children` sits just above them.
 */
export function DiaryDock({ actions, children }: { actions: readonly BarAction[]; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ zIndex: 10 }}>
      {children ? <View pointerEvents="box-none" style={{ position: 'absolute', bottom: '100%', left: 0, right: 0 }}>{children}</View> : null}
      <PaperTabs items={actions} bottomInset={insets.bottom} />
    </View>
  );
}
