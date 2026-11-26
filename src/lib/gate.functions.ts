import { createHash, timingSafeEqual } from "node:crypto";
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
        id: `saved-${row.id}`,
        title: row.title,
        fileName: `${row.title}.html`,
        url: "",
        kind: "saved" as const,
      }));
      saved = savedRows;
    } catch {
      // Cloud storage isn't configured on this host; show the built-in games only.
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
    throw new Error("Saving games only works on the Lovable-hosted site.");
  }
}

async function requireUnlocked() {
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked || session.data.email !== ALLOWED_EMAIL) {
    throw new Error("Please sign in first.");
  }
}

export const addSavedGame = createServerFn({ method: "POST" })
  .inputValidator((data: { title: string; html: string }) => {
    const title = String(data.title ?? "").trim().slice(0, 100);
    const html = String(data.html ?? "");
    if (!title) throw new Error("Please give the game a name.");
    if (!html.trim()) throw new Error("Paste some HTML first.");
    if (html.length > 20_000_000) throw new Error("That HTML is too large to save.");
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
    return { html: row.html };
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
    const { error } = await supabaseAdmin.from("saved_games").delete().eq("id", data.id);
    if (error) throw new Error("Could not remove the game. Try again.");
    return { ok: true as const };
  });

export { isAllowedEmail };
