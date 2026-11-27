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
import { editorUploadFromFiles } from "@/lib/editor-upload";
import type { PythonPackage } from "@/lib/python-package";

export const Route = createFileRoute("/")({
  loader: () => getGateContent(),
  head: () => ({
    meta: [
      { title: "FullFrame — Run HTML, JavaScript & Python" },
      { name: "description", content: "Paste code or upload HTML, Python, ZIPs, and folders, then run them across the whole page." },
      { property: "og:title", content: "FullFrame — Run HTML, JavaScript & Python" },
      { property: "og:description", content: "Run HTML packages with their assets, JavaScript, and Python directly in your browser." },
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
  const [pythonPackage, setPythonPackage] = useState<PythonPackage | null>(null);
  const [code, setCode] = useState(SAMPLE);
  const [language, setLanguage] = useState<EditorLanguage>("html");
  const [scripts, setScripts] = useState<Record<"javascript" | "python", string>>(LANGUAGE_SAMPLES);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pythonFileName, setPythonFileName] = useState<string | null>(null);
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
      const upload = await editorUploadFromFiles(incoming);
      if (sequence !== loadSequence.current) return;

      if (upload.language === "python") {
        setPythonPackage(upload.pythonPackage);
        setScripts((current) => ({ ...current, python: upload.pythonPackage.code }));
        setPythonFileName(upload.pythonPackage.name);
        setLanguage("python");
        const nextSession = await createPreviewSession(
          createStandalonePackage(buildRunnerHtml("python", upload.pythonPackage.code, upload.pythonPackage)),
        );
        if (sequence === loadSequence.current) setSession(nextSession);
        return;
      }

      setHtmlPackage(upload.htmlPackage);
      setCode(packageEntryCode(upload.htmlPackage));
      setFileName(upload.htmlPackage.name);
      setLanguage("html");
      const nextSession = await createPreviewSession(upload.htmlPackage);
      if (sequence === loadSequence.current) setSession(nextSession);
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
          language === "html"
            ? htmlPackage
            : createStandalonePackage(
                buildRunnerHtml(language, scripts[language], language === "python" ? pythonPackage : null),
              ),
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start this code.");
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
      setLanguage("html");
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

  const addGame = async () => {
    const rawCode = language === "html" ? code : scripts[language];
    if (!rawCode.trim()) {
      setError("Paste or upload a game first.");
      return;
    }
    const title = window.prompt("What should this game be called?")?.trim();
    if (!title) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payloadHtml =
        language === "html"
          ? code
          : buildRunnerHtml(language, scripts[language], language === "python" ? pythonPackage : null);
      await saveGame({ data: { title, html: payloadHtml } });
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

  const activeFileName = language === "html" ? fileName : language === "python" ? pythonFileName : null;

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
          {activeFileName && (
            <span className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">{activeFileName}</span>
          )}
          <button
            onClick={() => setSession(null)}
