import { Platform } from 'react-native';
import { requestWidgetUpdate, type WidgetTaskHandler } from 'react-native-android-widget';
import { syncAppIcon } from '../device/appIcon';
import { TODAY_WIDGET, TodayWidget } from './TodayWidget';
import { loadTodayWidget } from './widgetData';

/**
 * Runs headless when Android asks the widget to draw (added, resized, every 30 minutes). The
 * half-hourly run also turns the app icon's bunny to its current mood, since the app isn't open.
 */
export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetAction, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(<TodayWidget {...await loadTodayWidget()} />);
  if (widgetAction === 'WIDGET_UPDATE') await syncAppIcon();
};

/** Redraws the widget now (after a save, or a change of paper). Does nothing if it isn't on the home screen. */
export function refreshWidget(): void {
  if (Platform.OS !== 'android') return;
  requestWidgetUpdate({
    widgetName: TODAY_WIDGET,
    renderWidget: async () => <TodayWidget {...await loadTodayWidget()} />,
  }).catch((error: unknown) => console.warn('[widget] update failed', error));
}
