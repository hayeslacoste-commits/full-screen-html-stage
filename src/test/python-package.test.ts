import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createPythonPackage, pythonPackageFromFiles } from "@/lib/python-package";
import type { PreviewFile } from "@/lib/html-package";

function textFile(path: string, text: string): PreviewFile {
  return { path, data: new TextEncoder().encode(text), type: "" };
}

function uploadFile(name: string, contents: Uint8Array, type: string): File {
  const file = new File([], name, { type });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength),
  });
  return file;
}

describe("Python uploads", () => {
  it("opens main.py from a ZIP and removes its wrapper folder", async () => {
    const archive = zipSync({
      "my-project/README.txt": new TextEncoder().encode("Python project"),
      "my-project/helper.py": new TextEncoder().encode("VALUE = 42"),
      "my-project/main.py": new TextEncoder().encode("print('ZIP Python works')"),
    });
    const file = uploadFile("my-project.zip", archive, "application/zip");

    const result = await pythonPackageFromFiles([{ file, path: file.name }]);

    expect(result.entryPath).toBe("main.py");
    expect(result.code).toBe("print('ZIP Python works')");
    expect(result.pythonFiles).toEqual(["main.py", "helper.py"]);
  });

  it("accepts a single .py file", async () => {
    const file = uploadFile("hello.py", new TextEncoder().encode("print('Direct Python works')"), "text/x-python");

    const result = await pythonPackageFromFiles([{ file, path: file.name }]);

    expect(result.name).toBe("hello.py");
    expect(result.entryPath).toBe("hello.py");
    expect(result.code).toBe("print('Direct Python works')");
  });

  it("prefers a root main.py over nested Python files", () => {
    const result = createPythonPackage([
      textFile("project/tools/main.py", "print('nested')"),
      textFile("project/main.py", "print('root')"),
    ]);

    expect(result.entryPath).toBe("main.py");
    expect(result.code).toBe("print('root')");
  });

  it("reports uploads with no runnable page or Python file", () => {
    expect(() => createPythonPackage([textFile("README.txt", "notes only")])).toThrow(
      "No HTML page, Flash game, or Python (.py) file found",
    );
  });
});
