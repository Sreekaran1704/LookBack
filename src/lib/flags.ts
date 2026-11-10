/**
 * Developer tools (seed data, test notification) show in dev mode and in EAS "preview" builds,
 * which set EXPO_PUBLIC_SHOW_DEV_TOOLS=1 in eas.json. Production builds never show them.
 */
export const SHOW_DEV_TOOLS: boolean = __DEV__ || process.env.EXPO_PUBLIC_SHOW_DEV_TOOLS === '1';
