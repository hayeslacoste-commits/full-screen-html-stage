import { describe, expect, it } from "vitest";
import {
  createHtmlPackage,
  createStandalonePackage,
  packageEntryCode,
  packagePages,
  updatePackageEntry,
  type PreviewFile,
} from "@/lib/html-package";

function textFile(path: string, text: string): PreviewFile {
  return { path, data: new TextEncoder().encode(text), type: "" };
}

describe("HTML packages", () => {
  it("removes one ZIP wrapper folder and starts at its index page", () => {
    const result = createHtmlPackage([
      textFile("my-site/pages/other.html", "<h1>Other</h1>"),
      textFile("my-site/index.html", "<h1>Home</h1>"),
      textFile("my-site/assets/site.css", "body { color: green }"),
    ]);

    expect(result.entryPath).toBe("index.html");
    expect(result.files.map((file) => file.path)).toEqual([
      "pages/other.html",
      "index.html",
      "assets/site.css",
    ]);
    expect(packagePages(result)).toEqual(["pages/other.html", "index.html"]);
  });

  it("prefers a root index over nested HTML pages", () => {
    const result = createHtmlPackage([
      textFile("games/crossy/index.html", "nested"),
      textFile("index.html", "root"),
      textFile("about.html", "about"),
    ]);

    expect(result.entryPath).toBe("index.html");
  });

  it("keeps linked scripts, styles, and binary assets byte-for-byte", () => {
    const wasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
    const result = createHtmlPackage([
      textFile("index.html", "<script type='module' src='game.js'></script>"),
      textFile("game.js", "export const ready = true"),
      textFile("style.css", "body { margin: 0 }"),
      { path: "engine.wasm", data: wasm, type: "application/wasm" },
    ]);

    expect(result.files.find((file) => file.path === "engine.wasm")?.data).toEqual(wasm);
    expect(result.files.find((file) => file.path === "game.js")?.data).toEqual(
      new TextEncoder().encode("export const ready = true"),
    );
  });

  it("updates only the edited page and preserves the rest of the package", () => {
    const original = createHtmlPackage([
      textFile("index.html", "<h1>Before</h1>"),
      textFile("style.css", "body { color: green }"),
    ]);
    const updated = updatePackageEntry(original, "<h1>After</h1>");

    expect(packageEntryCode(updated)).toBe("<h1>After</h1>");
    expect(new TextDecoder().decode(updated.files.find((file) => file.path === "style.css")?.data)).toBe(
      "body { color: green }",
    );
  });

  it("ignores unsafe ZIP paths and reports packages without a page", () => {
    const result = createHtmlPackage([
      textFile("../outside.html", "outside"),
      textFile("safe/index.html", "safe"),
    ]);
    expect(result.files.map((file) => file.path)).toEqual(["index.html"]);

    expect(() => createHtmlPackage([textFile("image.png", "not really a page")])).toThrow(
      "No HTML page or Flash game found",
    );
  });

  it("creates a local Flash player page for ZIPs that contain only a SWF", () => {
    const swf = new Uint8Array([70, 87, 83]);
    const result = createHtmlPackage([
      textFile("papasbakeria/gameinfo.txt", "Instructions, not a start page"),
      { path: "papasbakeria/papasbakeria.swf", data: swf, type: "application/x-shockwave-flash" },
    ]);

    expect(result.entryPath).toBe("index.html");
    expect(result.files.find((file) => file.path === "papasbakeria.swf")?.data).toEqual(swf);
    expect(packageEntryCode(result)).toContain('url: "papasbakeria.swf"');
    expect(packageEntryCode(result)).toContain('src="/ruffle/ruffle.js"');
  });

  it("uses index.html for pasted HTML", () => {
    const result = createStandalonePackage("<h1>Pasted</h1>");
    expect(result.entryPath).toBe("index.html");
    expect(packageEntryCode(result)).toBe("<h1>Pasted</h1>");
  });
});
