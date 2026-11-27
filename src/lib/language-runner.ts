import type { PythonPackage } from "@/lib/python-package";

export type EditorLanguage = "html" | "javascript" | "python";

export const LANGUAGES: { id: EditorLanguage; label: string }[] = [
  { id: "html", label: "HTML" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
];

export const LANGUAGE_SAMPLES: Record<Exclude<EditorLanguage, "html">, string> = {
  javascript: 'const names = ["Hayes", "FullFrame"];\nfor (const name of names) console.log("Hello, " + name + "!");\nconsole.log("2 + 2 =", 2 + 2);',
  python: 'import math\n\nfor n in range(1, 6):\n    print(n, "squared is", n * n)\nprint("Pi is about", round(math.pi, 4))',
};

export const PYODIDE_URL = "https://unpkg.com";

/** Embed text safely inside an inline <script>. */
export function scriptLiteral(code: string) {
  return JSON.stringify(code)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function bytesToBase64(data: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function shellPage(title: string, body: string): string {
  return [
    "<!doctype html>",
    '<html><head><meta charset="utf-8"><title>' + title + "</title>",
    "<style>",
    "body{margin:0;min-height:100vh;background:#0d1117;color:#e6edf3;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace}",
    "#out{margin:0;padding:56px 20px 20px;white-space:pre-wrap;word-break:break-word}",
    ".err{color:#ff7b72}.info{color:#8b949e}",
    "</style></head><body><pre id=\"out\"></pre>",
    "<script>",
    'const out=document.getElementById("out");',
    'function write(text,cls){const s=document.createElement("span");if(cls)s.className=cls;s.textContent=text+"\\n";out.appendChild(s);}',
    'function fmt(v){if(typeof v==="string")return v;try{return JSON.stringify(v,null,2)??String(v);}catch{return String(v);}}',
    'window.addEventListener("error",e=>write(String(e.error??e.message),"err"));',
    'window.addEventListener("unhandledrejection",e=>write(String(e.reason),"err"));',
    "</script>",
    body,
    "</body></html>",
  ].join("\n");
}

export function buildRunnerHtml(
  language: EditorLanguage,
  code: string,
  pythonPackage?: PythonPackage | null,
): string {
  if (language === "html") return code;

  if (language === "javascript") {
    const jsBody = [
      "<script>",
      'for (const k of ["log","info","warn","error","debug"]) {',
      "  const orig=console[k].bind(console);",
      '  console[k]=(...a)=>{orig(...a);write(a.map(fmt).join(" "),k==="error"||k==="warn"?"err":"");};',
      "}",
      'const s=document.createElement("script");s.textContent=' + scriptLiteral(code) + ";document.body.appendChild(s);",
      "</script>",
    ].join("\n");
    return shellPage("JavaScript", jsBody);
  }

  const extraFiles = (pythonPackage?.files ?? [])
    .filter((f) => f.path !== pythonPackage?.entryPath)
    .map((f) => ({ path: f.path, b64: bytesToBase64(f.data) }));

    const pyBody = [
    "<script>",
    "(async()=>{",
    '  write("Downloading Python runtime…","info");',
    '  const cdns=[location.protocol+"//cdn.jsdelivr.net/pyodide/v0.26.4/full/",location.protocol+"//://unpkg.com"];',
    "  let loadedBase=null;",
    "  for(const base of cdns){",
    "    try{",
    "      await new Promise((resolve,reject)=>{",
    '        const s=document.createElement("script");',
    '        s.src=base+"pyodide.js";',
    "        s.onload=resolve;",
    "        s.onerror=reject;",
    "        document.head.appendChild(s);",
    "      });",
    "      if(typeof window.loadPyodide===\"function\"){loadedBase=base;break;}",
    "    }catch{}",
    "  }",
    "  try{",
    '    if(!loadedBase)throw new Error("Could not reach any Pyodide CDN from this browser.");',
    "    const py=await window.loadPyodide({indexURL:loadedBase});",
    '    out.textContent="";',
    "    py.setStdout({batched:t=>write(t)});",
    '    py.setStderr({batched:t=>write(t,"err")});',
    "    const files=" + scriptLiteral(JSON.stringify(extraFiles)) + ";",
    "    for(const f of JSON.parse(files)){",
    '      const parts=f.path.split("/");',
    "      if(parts.length>1){",
    '        py.FS.mkdirTree("/home/pyodide/"+parts.slice(0,-1).join("/"));',
    "      }",
    "      const raw=atob(f.b64);",
    "      const bytes=new Uint8Array(raw.length);",
    "      for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);",
    '      py.FS.writeFile("/home/pyodide/"+f.path,bytes);',
    "    }",
    "    const code=" + scriptLiteral(code) + ";",
    "    await py.loadPackagesFromImports(code);",
    "    await py.runPythonAsync(code);",
    '  }catch(e){write(String(e.message??e),"err");}',
    "})();",
    "</script>",
  ].join("\n");

  return shellPage("Python", pyBody);
}
