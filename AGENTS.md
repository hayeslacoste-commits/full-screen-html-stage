<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- HTML previews use the shared service-worker package runtime (`src/lib/preview-runtime.ts` and `public/fullframe-sw.js`) for pasted, uploaded, and dropped content so relative assets and navigation resolve at real URLs; preserve the Blob fallback only for standalone documents.
- The private game library is returned only by the encrypted-session gate in `src/lib/gate.functions.ts`; never move game manifests or credentials into public loader data, and keep passwords server-only.
- SWF-only uploads and archives get a generated HTML launcher using Ruffle; keep its script in `public/ruffle/`, serve its large WASM files through the asset-backed mappings in `public/fullframe-sw.js`, prefer Flash over instruction text, and preserve the narrowly scoped provider relay.
