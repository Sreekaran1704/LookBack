import { Platform } from 'react-native';
import { requestWidgetUpdate, type WidgetTaskHandler } from 'react-native-android-widget';
import { syncAppIcon } from '../device/appIcon';
import { PERSON_WIDGET, PersonWidget } from './PersonWidget';
import { TODAY_WIDGET, TodayWidget } from './TodayWidget';
import { loadPersonWidget, loadTodayWidget } from './widgetData';

/**
 * Runs headless when Android asks a widget to draw (added, resized, every 30 minutes). The half-hourly run also turns
 * the app icon to its current state, since the app isn't open.
 */
export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetInfo, widgetAction, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  if (widgetInfo.widgetName === PERSON_WIDGET) renderWidget(<PersonWidget {...await loadPersonWidget()} />);
  else renderWidget(<TodayWidget {...await loadTodayWidget()} />);
  if (widgetAction === 'WIDGET_UPDATE') await syncAppIcon();
};

/** Redraws the Today widget now (after a save, or a change of look). Does nothing if it isn't on the home screen. */
export function refreshWidget(): void {
  if (Platform.OS !== 'android') return;
  requestWidgetUpdate({
    widgetName: TODAY_WIDGET,
    renderWidget: async () => <TodayWidget {...await loadTodayWidget()} />,
  }).catch((error: unknown) => console.warn('[widget] update failed', error));
  refreshPersonWidget();
}

/** Redraws the "From your person" widget (a page arrived, was opened or removed, or the person changed). */
export function refreshPersonWidget(): void {
  if (Platform.OS !== 'android') return;
  requestWidgetUpdate({
    widgetName: PERSON_WIDGET,
    renderWidget: async () => <PersonWidget {...await loadPersonWidget()} />,
  }).catch((error: unknown) => console.warn('[widget] person update failed', error));
}
