import { describe, expect, it } from "vitest";
import { prepareHtmlForPreview } from "@/lib/html-compatibility";

describe("prepareHtmlForPreview", () => {
  it("guards the Google export parent API call so embedded launchers continue loading", () => {
    const input = '<script>window.parent.maeExportApis_(); document.getElementById("startButton").addEventListener("click", startGame);</script>';
    const output = prepareHtmlForPreview(input);

    expect(output).not.toContain("window.parent.maeExportApis_();");
    expect(output).toContain("window.parent === window");
    expect(output).toContain('typeof window.maeExportApis_ === "function"');
    expect(output).toContain('addEventListener("click", startGame)');
  });

  it("runs YouTube Playables files in standalone mode instead of waiting for a YouTube parent", () => {
    const input = '<script src="https://example.com/youtube-playables/main/ytgame.js" nonce="abc"></script><script src="scripts/game.min.js"></script>';
    const output = prepareHtmlForPreview(input);

    expect(output).not.toContain('src="https://example.com/youtube-playables/main/ytgame.js"');
    expect(output).toContain("IN_PLAYABLES_ENV: false");
    expect(output).toContain('loadData: function () { return resolved(""); }');
    expect(output).toContain("isAudioEnabled: function () { return true; }");
    expect(output).toContain('<script src="scripts/game.min.js"></script>');
  });

  it("leaves HTML without a known incompatible parent call unchanged", () => {
    const input = "<!doctype html><title>My game</title><script>startGame();</script>";
    expect(prepareHtmlForPreview(input)).toBe(input);
  });
});
