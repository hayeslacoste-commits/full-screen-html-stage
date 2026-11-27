import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader, useSession } from "@tanstack/react-start/server";
import {
  ALLOWED_EMAIL,
  isAllowedEmail,
  normalizeEmail,
  savedGameRowId,
  type GateContent,
  type LibraryGame,
} from "@/lib/gate-shared";

type GateSession = { unlocked?: boolean; email?: string };

const STORAGE_BUCKET = "saved-games";
const STORAGE_PREFIX = "__storage__:";

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "fullframe-gate",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

function valuesMatch(input: string, expected: string) {
  const inputDigest = createHash("sha256").update(input, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(inputDigest, expectedDigest);
}

export const getGateContent = createServerFn({ method: "GET" }).handler(
  async (): Promise<GateContent> => {
    setResponseHeader("cache-control", "private, no-store");
    const session = await useSession<GateSession>(sessionConfig());
    if (!session.data.unlocked || session.data.email !== ALLOWED_EMAIL) {
      return { unlocked: false };
    }

    const { gameLibrary } = await import("@/lib/games.server");
    let saved: LibraryGame[] = [];
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("saved_games")
        .select("id, title")
        .order("created_at", { ascending: true });
      const savedRows: LibraryGame[] = (data ?? []).map((row) => ({
        id: "saved-" + row.id,
        title: row.title,
        fileName: row.title + ".html",
        url: "",
        kind: "saved" as const,
      }));
      saved = savedRows;
    } catch {
      // Cloud storage isn't configured on this host; show built-in games only.
    }
    return { unlocked: true, email: ALLOWED_EMAIL, games: [...gameLibrary, ...saved] };
  },
);

export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", "private, no-store");
    const expectedPassword = process.env["SITE_PASSWORD"];
    if (!expectedPassword) throw new Error("Sign-in is not configured yet.");

    const emailMatches = valuesMatch(normalizeEmail(data.email), ALLOWED_EMAIL);
    const passwordMatches = valuesMatch(data.password, expectedPassword);
    if (!emailMatches || !passwordMatches) return { ok: false as const };

    const session = await useSession<GateSession>(sessionConfig());
    await session.update({ unlocked: true, email: ALLOWED_EMAIL });
    return { ok: true as const };
  });

export const lockSite = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("cache-control", "private, no-store");
  const session = await useSession<GateSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

async function loadCloud() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  } catch {
    throw new Error("Cloud storage is not configured.");
  }
}

async function requireUnlocked() {
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked || session.data.email !== ALLOWED_EMAIL) {
    throw new Error("Please sign in first.");
  }
}

export const createSavedGameUpload = createServerFn({ method: "POST" })
  .inputValidator((data: { title: string }) => {
    const title = String(data.title ?? "").trim().slice(0, 100);
    if (!title) throw new Error("Please give the game a name.");
    return { title };
  })
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", "private, no-store");
    await requireUnlocked();
    const supabaseAdmin = await loadCloud();
    const storagePath = randomUUID() + ".html";
    const { data: signed, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (error || !signed) {
      throw new Error(error?.message ?? "Could not start upload. Create the 'saved-games' bucket in Supabase Storage.");
    }
    return { title: data.title, storagePath, signedUrl: signed.signedUrl };
  });

export const finalizeSavedGameUpload = createServerFn({ method: "POST" })
  .inputValidator((data: { title: string; storagePath: string }) => {
    const title = String(data.title ?? "").trim().slice(0, 100);
    const storagePath = String(data.storagePath ?? "").trim();
    if (!title || !storagePath || storagePath.includes("..")) {
      throw new Error("Invalid upload details.");
    }
    return { title, storagePath };
  })
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", "private, no-store");
    await requireUnlocked();
    const supabaseAdmin = await loadCloud();
    const { error } = await supabaseAdmin
      .from("saved_games")
      .insert({ title: data.title, html: STORAGE_PREFIX + data.storagePath });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const addSavedGame = createServerFn({ method: "POST" })
  .inputValidator((data: { title: string; html: string }) => {
    const title = String(data.title ?? "").trim().slice(0, 100);
    const html = String(data.html ?? "");
    if (!title) throw new Error("Please give the game a name.");
    if (!html.trim()) throw new Error("Paste some HTML first.");
    return { title, html };
  })
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", "private, no-store");
    await requireUnlocked();
    const supabaseAdmin = await loadCloud();
    const { error } = await supabaseAdmin.from("saved_games").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getSavedGameHtml = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => {
    const id = savedGameRowId(String(data.id ?? ""));
    if (!id) throw new Error("Which game should be opened?");
    return { id };
  })
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", "private, no-store");
    await requireUnlocked();
    const supabaseAdmin = await loadCloud();
    const { data: row, error } = await supabaseAdmin
      .from("saved_games")
      .select("html")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("Could not find that game.");

    if (row.html.startsWith(STORAGE_PREFIX)) {
      const storagePath = row.html.slice(STORAGE_PREFIX.length);
      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 300);
      if (signError || !signed) throw new Error("Could not load that saved game file.");
      return { html: "", downloadUrl: signed.signedUrl };
    }

    return { html: row.html, downloadUrl: "" };
  });

export const removeSavedGame = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => {
    const id = savedGameRowId(String(data.id ?? ""));
    if (!id) throw new Error("Which game should be removed?");
    return { id };
  })
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", "private, no-store");
    await requireUnlocked();
    const supabaseAdmin = await loadCloud();
    const { data: row } = await supabaseAdmin
      .from("saved_games")
      .select("html")
      .eq("id", data.id)
      .single();

    if (row?.html?.startsWith(STORAGE_PREFIX)) {
      const storagePath = row.html.slice(STORAGE_PREFIX.length);
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
    }

    const { error } = await supabaseAdmin.from("saved_games").delete().eq("id", data.id);
    if (error) throw new Error("Could not remove the game. Try again.");
    return { ok: true as const };
  });

export { isAllowedEmail };
