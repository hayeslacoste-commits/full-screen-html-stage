import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FullFrame — Run HTML Full Screen" },
      { name: "description", content: "Paste HTML, CSS and JavaScript or upload an HTML file and run it instantly in full screen." },
      { property: "og:title", content: "FullFrame — Run HTML Full Screen" },
      { property: "og:description", content: "Paste or upload HTML and run it instantly in full screen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const SAMPLE = `<!doctype html>
<html><body style="margin:0;display:grid;place-items:center;height:100vh;background:#111;color:#0f0;font-family:monospace">
<h1>Hello, full screen!</h1>
</body></html>`;

function isHtmlFile(file: File) {
  return (
    file.type === "text/html" ||
    file.type === "application/xhtml+xml" ||
    /\.(html?|xhtml|svg|txt)$/i.test(file.name)
  );
}

function Index() {
  const [code, setCode] = useState(SAMPLE);
  const [fileName, setFileName] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const loadFile = useCallback((file: File) => {
    if (!isHtmlFile(file)) {
      setError(`"${file.name}" doesn't look like an HTML file.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCode(String(reader.result ?? ""));
      setFileName(file.name);
      setError(null);
    };
    reader.onerror = () => setError(`Could not read "${file.name}".`);
    reader.readAsText(file);
  }, []);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setRunning(false);
    window.addEventListener("keydown", onKey);
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onFs = () => !document.fullscreenElement && setRunning(false);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [running]);

  if (running) {
    return (
      <div className="fixed inset-0 bg-background">
        <iframe title="Output" srcDoc={code} sandbox="allow-scripts allow-modals allow-forms allow-popups" className="h-full w-full border-0" />
        <button onClick={() => setRunning(false)} className="fixed right-3 top-3 rounded-md bg-primary/80 px-3 py-1 text-xs text-primary-foreground hover:bg-primary">
          Exit (Esc)
        </button>
      </div>
    );
  }

  return (
    <main
      className="flex min-h-screen flex-col gap-4 bg-background p-6"
      onDragEnter={(e) => {
        if (!e.dataTransfer?.types?.includes("Files")) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) loadFile(file);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm,.xhtml,.svg,.txt,text/html"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadFile(file);
          e.target.value = "";
        }}
      />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-2xl font-bold text-foreground">FullFrame</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-input bg-card px-4 py-2 font-medium text-card-foreground hover:bg-accent"
          >
            ⬆ Upload HTML file
          </button>
          <button onClick={() => setRunning(true)} className="rounded-md bg-primary px-5 py-2 font-medium text-primary-foreground hover:bg-primary/90">
            ▶ Run full screen
          </button>
        </div>
      </header>
      <p className="text-sm text-muted-foreground">
        Paste your HTML below, upload a file, or drag a file onto this page. Press Esc to come back.
      </p>
      {fileName && (
        <p className="flex items-center gap-2 text-sm text-foreground">
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{fileName}</span>
          <button
            onClick={() => {
              setFileName(null);
              setCode(SAMPLE);
              setError(null);
            }}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Clear
          </button>
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <textarea
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setFileName(null);
        }}
        spellCheck={false}
        className={`min-h-[70vh] flex-1 rounded-lg border bg-card p-4 font-mono text-sm text-card-foreground outline-none focus:ring-2 focus:ring-ring ${
          dragging ? "border-primary ring-2 ring-ring" : "border-input"
        }`}
      />
    </main>
  );
}
