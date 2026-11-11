/**
 * Signs release builds with LookBack's own key when it is set up on this machine: the keystore path and
 * passwords come from ~/.gradle/gradle.properties (LOOKBACK_UPLOAD_*), never from the repo. Without
 * them (another machine, CI) release builds keep using the debug key, as before.
 *
 *   ./gradlew assembleRelease -PlookbackRelease=true   → signed with the LookBack key
 *   ./gradlew assembleRelease                          → debug key (local test builds; Drive sign-in is
 *                                                         registered for that key's SHA-1 too)
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING = `
        lookback {
            if (findProperty('LOOKBACK_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('LOOKBACK_UPLOAD_STORE_FILE'))
                storePassword findProperty('LOOKBACK_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('LOOKBACK_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('LOOKBACK_UPLOAD_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('lookback {')) {
      src = src.replace(/signingConfigs \{\n/, (m) => m + SIGNING.slice(1) + '\n');
      src = src.replace(
        /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
        "$1signingConfig((findProperty('lookbackRelease') && findProperty('LOOKBACK_UPLOAD_STORE_FILE')) ? signingConfigs.lookback : signingConfigs.debug)",
      );
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
