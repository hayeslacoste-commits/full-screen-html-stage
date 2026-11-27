import { describe, expect, it } from "vitest";
import { buildRunnerHtml, PYODIDE_URL } from "@/lib/language-runner";

describe("buildRunnerHtml", () => {
  it("returns HTML unchanged", () => {
    expect(buildRunnerHtml("html", "<p>hi</p>")).toBe("<p>hi</p>");
  });
  it("escapes closing script tags in JavaScript", () => {
    const html = buildRunnerHtml("javascript", 'console.log("</script>")');
    expect(html).not.toContain('"</script>"');
  });
  it("loads Pyodide for Python", () => {
    expect(buildRunnerHtml("python", "print(1)")).toContain(PYODIDE_URL);
  });
});
