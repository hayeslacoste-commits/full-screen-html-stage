import { describe, expect, it } from "vitest";
import { ALLOWED_EMAIL, isAllowedEmail, normalizeEmail } from "@/lib/gate-shared";

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
