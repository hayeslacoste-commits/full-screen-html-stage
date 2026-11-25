import { createHash, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader, useSession } from "@tanstack/react-start/server";
import {
  ALLOWED_EMAIL,
  isAllowedEmail,
  normalizeEmail,
  type GateContent,
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
    return { unlocked: true, email: ALLOWED_EMAIL, games: gameLibrary };
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

export { isAllowedEmail };
