import { packageFromFiles, type HtmlPackage, type IncomingFile } from "@/lib/html-package";
import { pythonPackageFromFiles, type PythonPackage } from "@/lib/python-package";

export type EditorUpload =
  | { language: "html"; htmlPackage: HtmlPackage }
  | { language: "python"; pythonPackage: PythonPackage };

const REAL_PAGE_EXTENSION = /\.(html?|xhtml|svg|swf)$/i;

/** Choose Python for code-only uploads, while preserving real HTML, SVG, and Flash packages. */
export async function editorUploadFromFiles(incoming: IncomingFile[]): Promise<EditorUpload> {
  let htmlPackage: HtmlPackage;

  try {
    htmlPackage = await packageFromFiles(incoming);
  } catch {
    return { language: "python", pythonPackage: await pythonPackageFromFiles(incoming) };
  }

  if (htmlPackage.files.some((file) => REAL_PAGE_EXTENSION.test(file.path))) {
    return { language: "html", htmlPackage };
  }

  try {
    return { language: "python", pythonPackage: await pythonPackageFromFiles(incoming) };
  } catch {
    // Plain text and instruction files remain viewable when no Python file exists.
    return { language: "html", htmlPackage };
  }
}
