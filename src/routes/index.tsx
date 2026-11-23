import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FullFrame — Run HTML Full Screen" },
      { name: "description", content: "Paste HTML, CSS and JavaScript and run it instantly in full screen." },
      { property: "og:title", content: "FullFrame — Run HTML Full Screen" },
      { property: "og:description", content: "Paste HTML and run it instantly in full screen." },
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

function Index() {
  const [code, setCode] = useState(SAMPLE);
  const [running, setRunning] = useState(false);

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
    <main className="flex min-h-screen flex-col gap-4 bg-background p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-mono text-2xl font-bold text-foreground">FullFrame</h1>
        <button onClick={() => setRunning(true)} className="rounded-md bg-primary px-5 py-2 font-medium text-primary-foreground hover:bg-primary/90">
          ▶ Run full screen
        </button>
      </header>
      <p className="text-sm text-muted-foreground">Paste your HTML below, then hit Run. Press Esc to come back.</p>
      <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false}
        className="min-h-[70vh] flex-1 rounded-lg border border-input bg-card p-4 font-mono text-sm text-card-foreground outline-none focus:ring-2 focus:ring-ring" />
    </main>
  );
}
