import { unzipSync } from "fflate";
import type { IncomingFile, PreviewFile } from "@/lib/html-package";

export interface PythonPackage {
  name: string;
  entryPath: string;
  code: string;
  pythonFiles: string[];
  files: PreviewFile[];
}

const PYTHON_EXTENSION = /\.py$/i;

function normalizedPath(path: string) {
  const parts = path.replace(/\\/g, "/").split("/");
  const clean: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") return null;
    clean.push(part);
  }

  return clean.join("/");
}

function comparePythonFiles(a: string, b: string) {
  const nameA = a.split("/").pop()?.toLowerCase() ?? a.toLowerCase();
  const nameB = b.split("/").pop()?.toLowerCase() ?? b.toLowerCase();
  const rank = (name: string) => name === "main.py" ? 0 : name === "__main__.py" ? 1 : name === "app.py" ? 2 : 3;

  return (
    rank(nameA) - rank(nameB) ||
    a.split("/").length - b.split("/").length ||
    a.localeCompare(b)
  );
}

/** Select the main Python file while keeping every file in the uploaded folder or ZIP. */
export function createPythonPackage(entries: PreviewFile[], name = "Python package"): PythonPackage {
  const cleaned = entries.flatMap((entry) => {
    if (entry.path.endsWith("/")) return [];
    const path = normalizedPath(entry.path);
    if (!path || path.startsWith("__MACOSX/") || path.endsWith("/.DS_Store")) return [];
    return [{ ...entry, path }];
  });

  const firstPath = cleaned[0]?.path;
  const wrapper = firstPath?.includes("/") ? firstPath.split("/")[0] : undefined;
  const files = wrapper && cleaned.every((entry) => entry.path.startsWith(`${wrapper}/`))
    ? cleaned.map((entry) => ({ ...entry, path: entry.path.slice(wrapper.length + 1) }))
    : cleaned;

  const pythonFiles = files.filter((entry) => PYTHON_EXTENSION.test(entry.path)).map((entry) => entry.path);
  pythonFiles.sort(comparePythonFiles);
  const entryPath = pythonFiles[0];

  if (!entryPath) {
    throw new Error("No HTML page, Flash game, or Python (.py) file found in that upload.");
  }

  const entry = files.find((file) => file.path === entryPath);
  if (!entry) throw new Error("The main Python file could not be read.");

  return {
    name,
    entryPath,
    code: new TextDecoder().decode(entry.data),
    pythonFiles,
    files,
  };
}

/** Read a Python file, folder, or ZIP after HTML package detection finds no page. */
export async function pythonPackageFromFiles(incoming: IncomingFile[]): Promise<PythonPackage> {
  if (incoming.length === 0) throw new Error("Choose an HTML file, Python file, ZIP, or folder first.");

  if (incoming.length === 1 && incoming[0]?.file.name.toLowerCase().endsWith(".zip")) {
    const source = incoming[0];
    const archive = unzipSync(new Uint8Array(await source.file.arrayBuffer()));
    const entries = Object.entries(archive).map(([path, data]) => ({ path, data, type: "" }));
    return createPythonPackage(entries, source.file.name);
  }

  if (incoming.some(({ file }) => file.name.toLowerCase().endsWith(".zip"))) {
    throw new Error("Upload a ZIP by itself, or select its extracted files together.");
  }

  const files = await Promise.all(
    incoming.map(async ({ file, path }) => ({
      path: path || file.webkitRelativePath || file.name,
      data: new Uint8Array(await file.arrayBuffer()),
      type: file.type,
    })),
  );

  const firstPath = incoming[0]?.path ?? "";
  const folderName = firstPath.includes("/") ? firstPath.split("/")[0] : undefined;
  const name = incoming.length === 1 ? incoming[0]?.file.name ?? "Python file" : folderName ?? "Python package";
  return createPythonPackage(files, name);
}
