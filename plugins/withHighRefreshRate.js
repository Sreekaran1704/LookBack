/**
 * Asks Android for the screen's fastest refresh rate (up to 120 Hz) while LookBack is open, so
 * scrolling and animations run at 120 fps on phones that support it. Without this, phones like the
 * OnePlus Nord 5 draw ordinary apps at 90 Hz. Capped at 120 Hz: 144 Hz costs battery for no visible gain.
 */
const { withMainActivity } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const MAX_HZ = 121;

module.exports = function withHighRefreshRate(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    src = mergeContents({
      src,
      newSrc: '    preferHighRefreshRate()',
      tag: 'lookback-high-refresh-call',
      anchor: /super\.onCreate\(/,
      offset: 1,
      comment: '//',
    }).contents;
    src = mergeContents({
      src,
      newSrc: [
        '  /** Picks the fastest display mode at the current resolution, up to 120 Hz. */',
        '  private fun preferHighRefreshRate() {',
        '    val screen = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) display else @Suppress("DEPRECATION") windowManager.defaultDisplay',
        '    screen ?: return',
        '    val current = screen.mode',
        '    val best = screen.supportedModes',
        '      .filter { it.physicalWidth == current.physicalWidth && it.physicalHeight == current.physicalHeight && it.refreshRate <= ' + MAX_HZ + 'f }',
        '      .maxByOrNull { it.refreshRate } ?: return',
        '    val params = window.attributes',
        '    params.preferredDisplayModeId = best.modeId',
        '    window.attributes = params',
        '  }',
      ].join('\n'),
      tag: 'lookback-high-refresh-fn',
      anchor: /override fun getMainComponentName/,
      offset: -4,
      comment: '//',
    }).contents;
    cfg.modResults.contents = src;
    return cfg;
  });
};
