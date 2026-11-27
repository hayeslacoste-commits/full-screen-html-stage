import { createFileRoute } from "@tanstack/react-router";
import { FilePlus, FolderOpen, Gamepad2, LockKeyhole, Play, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SignInControl } from "@/components/sign-in-control";
import { addSavedGame, getGateContent, getSavedGameHtml, removeSavedGame } from "@/lib/gate.functions";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { LibraryGame } from "@/lib/gate-shared";
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
import { buildRunnerHtml, LANGUAGES, LANGUAGE_SAMPLES, type EditorLanguage } from "@/lib/language-runner";

export const Route = createFileRoute("/")({
  loader: () => getGateContent(),
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
  const gate = Route.useLoaderData();
  const router = useRouter();
  const saveGame = useServerFn(addSavedGame);
  const loadSavedHtml = useServerFn(getSavedGameHtml);
  const removeGame = useServerFn(removeSavedGame);
  const [saving, setSaving] = useState(false);
  const [removingGame, setRemovingGame] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [htmlPackage, setHtmlPackage] = useState(() => createStandalonePackage(SAMPLE));
  const [code, setCode] = useState(SAMPLE);
  const [language, setLanguage] = useState<EditorLanguage>("html");
  const [scripts, setScripts] = useState<Record<"javascript" | "python", string>>(LANGUAGE_SAMPLES);
  const [fileName, setFileName] = useState<string | null>(null);
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [openingGame, setOpeningGame] = useState<string | null>(null);
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
      setLanguage("html");
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
      setSession(
        await createPreviewSession(
          language === "html" ? htmlPackage : createStandalonePackage(buildRunnerHtml(language, scripts[language])),
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start this HTML package.");
    } finally {
      setStarting(false);
    }
  };

  const openLibraryGame = async (game: LibraryGame) => {
    setOpeningGame(game.id);
    setError(null);
    try {
      let file: File;
      if (game.kind === "saved") {
        const { html } = await loadSavedHtml({ data: { id: game.id } });
        file = new File([html], game.fileName, { type: "text/html" });
      } else {
        const response = await fetch(game.url);
        if (!response.ok) throw new Error(`Could not download ${game.title}. Try again.`);
        file = new File([await response.blob()], game.fileName, {
          type: response.headers.get("content-type") ?? "application/octet-stream",
        });
      }
      const nextPackage = await packageFromFiles([{ file, path: game.fileName }]);
      setHtmlPackage(nextPackage);
      setCode(packageEntryCode(nextPackage));
      setFileName(nextPackage.name);
      setSession(await createPreviewSession(nextPackage));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not start ${game.title}.`);
    } finally {
      setOpeningGame(null);
    }
  };

  const removeLibraryGame = async (game: LibraryGame) => {
    if (!window.confirm(`Remove "${game.title}" from your game folder?`)) return;
    setRemovingGame(game.id);
    setError(null);
    setNotice(null);
    try {
      await removeGame({ data: { id: game.id } });
      setNotice(`Removed "${game.title}" from your game folder.`);
      await router.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not remove ${game.title}.`);
    } finally {
      setRemovingGame(null);
    }
  };

  const addHtml = async () => {
    if (!code.trim()) {
      setError("Paste some HTML first.");
      return;
    }
    const title = window.prompt("What should this game be called?")?.trim();
    if (!title) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveGame({ data: { title, html: code } });
      setNotice(`Saved "${title}" to your game folder.`);
      await router.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the game.");
    } finally {
      setSaving(false);
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
        <div className="absolute left-3 top-3 flex items-center gap-2">
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
        <h1 className="flex items-center gap-2 font-mono text-2xl font-bold text-foreground">
          <Gamepad2 className="size-7" aria-hidden="true" /> FullFrame
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <SignInControl gate={gate} />
          {gate.unlocked && language === "html" && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void addHtml()}
              className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-4 py-2 font-medium text-card-foreground hover:bg-accent disabled:opacity-50"
            >
              <FilePlus className="size-4" aria-hidden="true" />
              {saving ? "Saving…" : "Add HTML"}
            </button>
          )}
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
      {gate.unlocked ? (
        <section aria-label="Hayes's game folder" className="rounded-xl border border-border bg-card p-4 text-card-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <FolderOpen className="size-5" aria-hidden="true" /> Hayes's game folder
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose any game to open it across the page. Games you added have an ✕ to remove them.</p>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{gate.games.length} games</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {gate.games.map((game) => (
              <div key={game.id} className="relative">
                <button
                  type="button"
                  aria-label={`Play ${game.title}`}
                  disabled={openingGame !== null || removingGame !== null}
                  onClick={() => void openLibraryGame(game)}
                  className="group flex min-h-20 w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-left hover:border-primary hover:bg-accent disabled:opacity-60"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                    <Play className="size-4 fill-current" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium leading-tight">{openingGame === game.id ? "Opening…" : game.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{game.kind === "flash" ? "Flash classic" : game.kind === "saved" ? "Added by you" : "HTML game"}</span>
                  </span>
                </button>
                {game.kind === "saved" && (
                  <button
                    type="button"
                    aria-label={`Remove ${game.title}`}
                    title={`Remove ${game.title}`}
                    disabled={removingGame !== null}
                    onClick={() => void removeLibraryGame(game)}
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50"
                  >
                    {removingGame === game.id ? (
                      <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                    ) : (
                      <X className="size-3.5" aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
          Sign in to open Hayes's private game folder.
        </div>
      )}
      <div role="tablist" aria-label="Language" className="flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
        {LANGUAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={language === item.id}
            onClick={() => setLanguage(item.id)}
            className={`rounded-md px-3 py-1 font-mono text-sm ${language === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {language !== "html" && (
        <p className="text-xs text-muted-foreground">
          {language === "python" ? "Python runs right in your browser (the first run downloads Python, so give it a few seconds)." : "JavaScript runs in the page; console.log output is shown on screen."}
        </p>
      )}
      {language === "html" && fileName && (
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
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <textarea
        aria-label={`${LANGUAGES.find((item) => item.id === language)?.label} code`}
        value={language === "html" ? code : scripts[language]}
        onChange={(event) => {
          const nextCode = event.target.value;
          if (language !== "html") {
            setScripts((current) => ({ ...current, [language]: nextCode }));
            return;
          }
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
