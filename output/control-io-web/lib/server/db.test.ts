import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { backoffDelay, isTransientDbError, retryTransient } from "./db";

const known = (code: string) => new Prisma.PrismaClientKnownRequestError(`boom ${code}`, { code, clientVersion: "test" });

describe("isTransientDbError", () => {
  it("recognises lock waits, pool and transaction timeouts, write conflicts", () => {
    for (const code of ["P1008", "P2024", "P2028", "P2034"]) expect(isTransientDbError(known(code))).toBe(true);
  });
  it("leaves real errors alone", () => {
    for (const code of ["P2002", "P2025", "P2003"]) expect(isTransientDbError(known(code))).toBe(false);
    expect(isTransientDbError(new Error("P1008"))).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
  });
});

describe("backoffDelay", () => {
  it("is jittered within an exponentially growing, capped bound", () => {
    for (let attempt = 1; attempt <= 8; attempt++) {
      const cap = Math.min(2_000, 100 * 2 ** attempt);
      for (let i = 0; i < 50; i++) {
        const d = backoffDelay(attempt);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(cap);
      }
    }
  });
});

describe("retryTransient", () => {
  it("retries transient errors and returns the eventual result", async () => {
    let calls = 0;
    const out = await retryTransient(async () => {
      calls++;
      if (calls < 3) throw known("P1008");
      return "ok";
    }, 4);
    expect(out).toBe("ok");
    expect(calls).toBe(3);
  });
  it("gives up after the last attempt and rethrows", async () => {
    let calls = 0;
    await expect(
      retryTransient(async () => {
        calls++;
        throw known("P2028");
      }, 2),
    ).rejects.toMatchObject({ code: "P2028" });
    expect(calls).toBe(2);
  });
  it("does not retry other errors", async () => {
    let calls = 0;
    await expect(
      retryTransient(async () => {
        calls++;
        throw known("P2002");
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(calls).toBe(1);
  });
});
