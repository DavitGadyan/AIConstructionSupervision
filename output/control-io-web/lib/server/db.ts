import { Prisma, PrismaClient } from "@prisma/client";

// One client per process; Next dev hot-reload would otherwise open a new
// connection pool on every edit.
const g = globalThis as unknown as { __prisma?: PrismaClient };
export const db = g.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.__prisma = db;

// ---------------------------------------------------------------------------
// Temporary database errors
// ---------------------------------------------------------------------------

/**
 * Prisma codes that mean "the database is busy right now, try again":
 * - P1008: SQLite gave up waiting for the write lock (busy timeout, ~5 s)
 * - P2024: no pooled connection became free in time
 * - P2028: an interactive transaction could not start in time or expired
 *   (it was rolled back)
 * - P2034: write conflict or deadlock (the transaction was rolled back)
 * The operation did not happen, so a retry is safe for idempotent or
 * version-checked writes.
 */
export const TRANSIENT_DB_CODES: ReadonlySet<string> = new Set(["P1008", "P2024", "P2028", "P2034"]);

export function isTransientDbError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && TRANSIENT_DB_CODES.has(e.code);
}

/**
 * Interactive transaction limits. Prisma's defaults (2 s to start, 5 s to
 * finish) are too tight on a loaded machine: a transaction that merely
 * waited for its turn expired before its first query ran.
 */
export const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** "Full jitter" exponential backoff before retry `attempt` (1-based): random in [0, min(capMs, baseMs * 2^attempt)]. */
export function backoffDelay(attempt: number, baseMs = 100, capMs = 2_000): number {
  return Math.random() * Math.min(capMs, baseMs * 2 ** Math.max(0, attempt));
}

/** Runs `fn`, retrying temporary database errors (see TRANSIENT_DB_CODES) with jittered backoff. Other errors are thrown at once. */
export async function retryTransient<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= attempts || !isTransientDbError(e)) throw e;
      await sleep(backoffDelay(attempt));
    }
  }
}

/** Waits the jittered backoff for retry `attempt`. */
export function backoff(attempt: number): Promise<void> {
  return sleep(backoffDelay(attempt));
}
