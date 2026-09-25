/**
 * Next.js instrumentation: runs once when the server process starts.
 * - Production: refuses to start when AUTH_SECRET is missing, shorter than
 *   32 bytes or a published example value (lib/server/authSecret.ts); `next
 *   start` exits with an error instead of serving forgeable sessions.
 * - Starts the dispatch simulator ticker (lib/server/ticker.ts) in the Node.js
 *   runtime only - never on the edge runtime and never during `next build`.
 *   In production it only runs when DISPATCH_SIMULATOR=on is set explicitly.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { assertAuthSecret } = await import("./lib/server/authSecret");
    assertAuthSecret();
    const { ensureTicker } = await import("./lib/server/ticker");
    ensureTicker();
  }
}
