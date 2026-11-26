import { describe, expect, it } from "vitest";
import {
  ALLOWED_EMAIL,
  isAllowedEmail,
  normalizeEmail,
  savedGameRowId,
} from "@/lib/gate-shared";

describe("private game folder access", () => {
  it("allows only hayeslacoste@gmail.com", () => {
    expect(ALLOWED_EMAIL).toBe("hayeslacoste@gmail.com");
    expect(isAllowedEmail("hayeslacoste@gmail.com")).toBe(true);
    expect(isAllowedEmail("someone-else@gmail.com")).toBe(false);
  });

  it("accepts harmless capitalization and surrounding spaces in the allowed email", () => {
    expect(normalizeEmail("  HAYESLACOSTE@gmail.com  ")).toBe(ALLOWED_EMAIL);
  });
});

describe("saved game ids", () => {
  it("maps a folder entry id back to the stored row id", () => {
    expect(savedGameRowId("saved-3f2a91c0-7c4f-4d2b-9a1e-5b7c8d9e0f11")).toBe(
      "3f2a91c0-7c4f-4d2b-9a1e-5b7c8d9e0f11",
    );
    expect(savedGameRowId("3f2a91c0-7c4f-4d2b-9a1e-5b7c8d9e0f11")).toBe(
      "3f2a91c0-7c4f-4d2b-9a1e-5b7c8d9e0f11",
    );
    expect(savedGameRowId("  saved-abc123  ")).toBe("abc123");
  });

  it("leaves nothing behind for an empty or prefix-only id", () => {
    expect(savedGameRowId("saved-")).toBe("");
    expect(savedGameRowId("   ")).toBe("");
  });
});
