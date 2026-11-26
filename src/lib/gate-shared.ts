export const ALLOWED_EMAIL = "hayeslacoste@gmail.com";

export interface LibraryGame {
  id: string;
  title: string;
  fileName: string;
  url: string;
  kind: "html" | "flash" | "saved";
}

export type GateContent =
  | { unlocked: false }
  | { unlocked: true; email: string; games: readonly LibraryGame[] };

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAllowedEmail(email: string) {
  return normalizeEmail(email) === ALLOWED_EMAIL;
}

// Folder entries for cloud-saved games are id'd "saved-<row id>"; the stored row is just "<row id>".
export function savedGameRowId(id: string) {
  return id.trim().replace(/^saved-/, "");
}
