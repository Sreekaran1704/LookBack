// App entry: expo-router, plus the home-screen widget's headless handler (Android).
import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widget';

registerWidgetTaskHandler(widgetTaskHandler);
