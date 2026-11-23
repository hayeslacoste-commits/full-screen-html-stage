/**
 * Adjust HTML exported by Google Sites/Docs so it can run inside the preview.
 * The original export calls an API on window.parent, which is only valid when
 * the file is opened as a top-level page. There is no parent API to call here.
 */
export function prepareHtmlForPreview(code: string) {
  return code.replace(
    /window\s*\.\s*parent\s*\.\s*maeExportApis_\s*\(\s*\)\s*;?/g,
    'if (window.parent === window && typeof window.maeExportApis_ === "function") { window.maeExportApis_(); }',
  );
}
