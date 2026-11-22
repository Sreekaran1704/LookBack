/**
 * Keeps WebRTC's Java classes through the release build's code shrinker (R8). Its native side looks them up by name, and
 * one optional decoder class isn't shipped, which R8 otherwise stops the build on.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RULES = ['# lookback-webrtc-keep', '-keep class org.webrtc.** { *; }', '-dontwarn org.webrtc.**'].join('\n');

module.exports = function withWebRtcKeepRules(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!current.includes('# lookback-webrtc-keep')) fs.writeFileSync(file, `${current.trimEnd()}\n\n${RULES}\n`);
      return cfg;
    },
  ]);
};
