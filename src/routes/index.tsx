import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createStandalonePackage,
  filesFromDrop,
  filesFromFileList,
  packageEntryCode,
  packageFromFiles,
  packagePages,
  updatePackageEntry,
  type IncomingFile,
} from "@/lib/html-package";
import {
  createPreviewSession,
  disposePreviewSession,
  type PreviewSession,
} from "@/lib/preview-runtime";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FullFrame — Run HTML Full Screen" },
      { name: "description", content: "Paste HTML, upload a file, ZIP, or folder, and run it across the whole page with its assets." },
      { property: "og:title", content: "FullFrame — Run HTML Full Screen" },
      { property: "og:description", content: "Run standalone HTML or complete HTML packages with their scripts, styles, media, and linked pages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const SAMPLE = `<!doctype html>
<html><body style="margin:0;display:grid;place-items:center;height:100vh;background:#111;color:#0f0;font-family:monospace">
<h1>Hello, full page!</h1>
</body></html>`;

function Index() {
  const [htmlPackage, setHtmlPackage] = useState(() => createStandalonePackage(SAMPLE));
  const [code, setCode] = useState(SAMPLE);
  const [fileName, setFileName] = useState<string | null>(null);
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const loadSequence = useRef(0);

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  const loadIncoming = useCallback(async (incoming: IncomingFile[]) => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError(null);
    try {
      const nextPackage = await packageFromFiles(incoming);
      if (sequence !== loadSequence.current) return;
      setHtmlPackage(nextPackage);
      setCode(packageEntryCode(nextPackage));
      setFileName(nextPackage.name);
    } catch (cause) {
      if (sequence === loadSequence.current) {
        setError(cause instanceof Error ? cause.message : "Could not read those files.");
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSession(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    return () => disposePreviewSession(session);
  }, [session]);

  const run = async () => {
    setStarting(true);
    setError(null);
    try {
      setSession(await createPreviewSession(htmlPackage));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start this HTML package.");
    } finally {
      setStarting(false);
    }
  };

  const clear = () => {
    const sample = createStandalonePackage(SAMPLE);
    setHtmlPackage(sample);
    setCode(SAMPLE);
    setFileName(null);
    setError(null);
  };

  if (session) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <iframe
          key={session.url}
          title="Output"
          src={session.url}
          allow="autoplay; gamepad; clipboard-read; clipboard-write; encrypted-media; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-downloads allow-presentation allow-top-navigation-by-user-activation"
          className="h-full w-full border-0"
          onLoad={(event) => {
            try {
              event.currentTarget.contentDocument?.addEventListener(
                "keydown",
                (keyEvent) => {
                  if (keyEvent.key === "Escape") setSession(null);
                },
                true,
              );
            } catch {
              // A page that navigates to another origin still has the Exit button.
            }
          }}
        />
        <div className="absolute right-3 top-3 flex items-center gap-2">
          {fileName && (
            <span className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">{fileName}</span>
          )}
          <button
            onClick={() => setSession(null)}
            className="rounded-md bg-primary/80 px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary"
          >
            Exit (Esc)
          </button>
        </div>
      </div>
    );
  }

  const pages = packagePages(htmlPackage);

  return (
    <main
      className="flex min-h-screen flex-col gap-4 bg-background p-6"
      onDragEnter={(event) => {
        if (!event.dataTransfer?.types?.includes("Files")) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void filesFromDrop(event.dataTransfer).then(loadIncoming).catch((cause: unknown) => {
          setLoading(false);
          setError(cause instanceof Error ? cause.message : "Could not read the dropped files.");
        });
      }}
    >
      <input
        id="package-input"
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void loadIncoming(filesFromFileList(event.target.files));
          event.target.value = "";
        }}
      />
      <input
        id="folder-input"
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void loadIncoming(filesFromFileList(event.target.files));
          event.target.value = "";
        }}
      />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-2xl font-bold text-foreground">FullFrame</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-input bg-card px-4 py-2 font-medium text-card-foreground hover:bg-accent disabled:opacity-50"
          >
            ⬆ Upload HTML / ZIP
          </button>
          <button
            disabled={loading}
            onClick={() => folderInputRef.current?.click()}
            className="rounded-md border border-input bg-card px-4 py-2 font-medium text-card-foreground hover:bg-accent disabled:opacity-50"
          >
            Upload folder
          </button>
          <button
            disabled={loading || starting}
            onClick={() => void run()}
            className="rounded-md bg-primary px-5 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {starting ? "Starting…" : "▶ Run full page"}
          </button>
        </div>
      </header>
      <p className="text-sm text-muted-foreground">
        Paste HTML, choose a file or ZIP, add a whole folder, or drag them here. Linked files and pages run together — press Esc to come back.
      </p>
      {fileName && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{fileName}</span>
          {htmlPackage.files.length > 1 && (
            <span className="text-xs text-muted-foreground">{htmlPackage.files.length} files</span>
          )}
          {pages.length > 1 && (
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Start page
              <select
                aria-label="Start page"
                value={htmlPackage.entryPath}
                onChange={(event) => {
                  const entryPath = event.target.value;
                  const nextPackage = { ...htmlPackage, entryPath };
                  setHtmlPackage(nextPackage);
                  setCode(packageEntryCode(nextPackage));
                }}
                className="rounded border border-input bg-card px-2 py-1 font-mono text-card-foreground"
              >
                {pages.map((page) => <option key={page} value={page}>{page}</option>)}
              </select>
            </label>
          )}
          <button onClick={clear} className="text-xs text-muted-foreground underline hover:text-foreground">
            Clear
          </button>
        </div>
      )}
      {loading && <p className="text-sm text-muted-foreground">Reading your HTML package…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <textarea
        aria-label="HTML code"
        value={code}
        onChange={(event) => {
          const nextCode = event.target.value;
          setCode(nextCode);
          setHtmlPackage((current) => updatePackageEntry(current, nextCode));
        }}
        spellCheck={false}
        className={`min-h-[70vh] flex-1 rounded-lg border bg-card p-4 font-mono text-sm text-card-foreground outline-none focus:ring-2 focus:ring-ring ${
          dragging ? "border-primary ring-2 ring-ring" : "border-input"
        }`}
      />
    </main>
  );
}
