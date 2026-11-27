import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { editorUploadFromFiles } from "@/lib/editor-upload";

function zipUpload(entries: Record<string, string>) {
  const archive = zipSync(Object.fromEntries(
    Object.entries(entries).map(([path, text]) => [path, new TextEncoder().encode(text)]),
  ));
  const file = new File([], "project.zip", { type: "application/zip" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength),
  });
  return [{ file, path: file.name }];
}

describe("Editor upload detection", () => {
  it("opens a Python ZIP even when it also contains a README text file", async () => {
    const result = await editorUploadFromFiles(zipUpload({
      "project/README.txt": "Run main.py",
      "project/main.py": "print('Python ZIP')",
    }));

    expect(result.language).toBe("python");
    if (result.language === "python") {
      expect(result.pythonPackage.entryPath).toBe("main.py");
      expect(result.pythonPackage.code).toBe("print('Python ZIP')");
    }
  });

  it("keeps opening HTML when a ZIP contains both HTML and Python", async () => {
    const result = await editorUploadFromFiles(zipUpload({
      "project/index.html": "<h1>HTML page</h1>",
      "project/build.py": "print('build tool')",
    }));

    expect(result.language).toBe("html");
    if (result.language === "html") expect(result.htmlPackage.entryPath).toBe("index.html");
  });

  it("still opens a text-only ZIP as a text page", async () => {
    const result = await editorUploadFromFiles(zipUpload({
      "project/instructions.txt": "Instructions",
    }));

    expect(result.language).toBe("html");
    if (result.language === "html") expect(result.htmlPackage.entryPath).toBe("instructions.txt");
  });
});
