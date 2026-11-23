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

  it("leaves HTML without the Google export call unchanged", () => {
    const input = "<!doctype html><title>My game</title><script>startGame();</script>";
    expect(prepareHtmlForPreview(input)).toBe(input);
  });
});
