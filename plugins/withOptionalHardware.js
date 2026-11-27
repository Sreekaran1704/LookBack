/**
 * Marks hardware that Google Play would otherwise treat as required as optional, so LookBack isn't hidden from
 * tablets, Chromebooks or XR headsets that lack it. Play infers these from the manifest:
 *   - android.hardware.wifi            ← the ACCESS_WIFI_STATE permission (WebRTC sharing)
 *   - android.hardware.screen.portrait ← the activity being locked to portrait
 * Sharing also works over mobile data, and a portrait lock still runs on landscape-only screens.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const OPTIONAL = ['android.hardware.wifi', 'android.hardware.screen.portrait'];

module.exports = function withOptionalHardware(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest['uses-feature'] = manifest['uses-feature'] ?? []);
    for (const name of OPTIONAL) {
      const existing = features.find((f) => f.$?.['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
};
