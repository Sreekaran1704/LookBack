const { withGradleProperties } = require('expo/config-plugins');

/**
 * More memory for Gradle: with Firebase and WebRTC, R8 (the release shrinker) ran out of Metaspace at the default
 * 512 MB and the release build failed.
 */
module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    const args = '-Xmx6g -XX:MaxMetaspaceSize=2g';
    const existing = cfg.modResults.find((p) => p.type === 'property' && p.key === 'org.gradle.jvmargs');
    if (existing) existing.value = args;
    else cfg.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: args });
    return cfg;
  });
};
