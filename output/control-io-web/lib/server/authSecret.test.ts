import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAuthSecret, authSecretKey, authSecretProblem } from "./authSecret";

const STRONG = "k3Jx9mZq0vT7bW2nR8yL5cF1hD4gS6aPuE0iO9tYw=="; // 44 bytes, not published
const PUBLISHED = "dev-only-change-me-0123456789abcdef";

afterEach(() => vi.unstubAllEnvs());

describe("authSecretProblem", () => {
  it("accepts a random value of at least 32 bytes", () => {
    expect(authSecretProblem(STRONG)).toBeNull();
  });
  it("rejects missing, short and published values", () => {
    expect(authSecretProblem(undefined)).toMatch(/not set/);
    expect(authSecretProblem("   ")).toMatch(/not set/);
    expect(authSecretProblem("x".repeat(31))).toMatch(/shorter than 32 bytes/);
    expect(authSecretProblem(PUBLISHED)).toMatch(/published/);
  });
});

describe("production", () => {
  it("refuses to start (and to sign) without a strong AUTH_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const v of ["", "short", PUBLISHED]) {
      vi.stubEnv("AUTH_SECRET", v);
      expect(() => assertAuthSecret()).toThrow(/AUTH_SECRET/);
      expect(() => authSecretKey()).toThrow(/openssl rand/);
    }
    vi.stubEnv("AUTH_SECRET", STRONG);
    expect(() => assertAuthSecret()).not.toThrow();
    expect(new TextDecoder().decode(authSecretKey())).toBe(STRONG);
  });
});

describe("development", () => {
  it("keeps working with a missing or weak key (with a warning)", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => assertAuthSecret()).not.toThrow();
    expect(authSecretKey().length).toBeGreaterThanOrEqual(32);
    vi.stubEnv("AUTH_SECRET", PUBLISHED);
    expect(new TextDecoder().decode(authSecretKey())).toBe(PUBLISHED);
    warn.mockRestore();
  });
});
