const YOUTUBE_PLAYABLES_SCRIPT =
  /<script\b[^>]*\bsrc\s*=\s*(["'])(?:[^"']*\/)?ytgame\.js(?:\?[^"']*)?\1[^>]*>\s*<\/script>/gi;

// The official SDK treats every iframe as YouTube, disables browser storage,
// and waits for YouTube's parent page to answer. FullFrame is not YouTube, so
// standalone files need the SDK's non-embedded behavior instead.
const STANDALONE_YTGAME = `
(function () {
  var listener = function () { return function () {}; };
  var resolved = function (value) { return Promise.resolve(value); };
  window.ytgame = {
    IN_PLAYABLES_ENV: false,
    SDK_VERSION: "standalone",
    ads: { requestAd: function () { return resolved(0); } },
    engagement: {
      sendScore: function () { return resolved(); },
      openYTContent: function () { return resolved(); },
      shareInviteCode: function () { return resolved(); }
    },
    game: {
      loadData: function () { return resolved(""); },
      saveData: function () { return resolved(); },
      firstFrameReady: function () {},
      gameReady: function () {},
      onGameDataAvailable: listener
    },
    health: { logError: function () {}, logWarning: function () {} },
    system: {
      isAudioEnabled: function () { return true; },
      onAudioEnabledChange: listener,
      onPause: listener,
      onResume: listener,
      getLanguage: function () { return resolved("en"); }
    }
  };
})();`;

/**
 * Adjust exported HTML so it can run inside the preview just as it does when
 * opened directly from Downloads.
 */
export function prepareHtmlForPreview(code: string) {
  return code
    .replace(YOUTUBE_PLAYABLES_SCRIPT, `<script>${STANDALONE_YTGAME}</script>`)
    .replace(
      /window\s*\.\s*parent\s*\.\s*maeExportApis_\s*\(\s*\)\s*;?/g,
      'if (window.parent === window && typeof window.maeExportApis_ === "function") { window.maeExportApis_(); }',
    );
}
