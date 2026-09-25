/**
 * The key that signs session tokens (AUTH_SECRET, HS256).
 *
 * Anyone who knows it can mint a valid token for any user id, so in
 * production (NODE_ENV=production) it must be set, at least 32 bytes long and
 * not a value that was ever published. `assertAuthSecret()` runs at server
 * startup (instrumentation.ts) and refuses to start otherwise; `authSecretKey()`
 * applies the same rule on every use, so a misconfigured production server
 * can never sign or accept tokens with a guessable key.
 *
 * Development and tests fall back to a fixed dev-only key, with a warning.
 * Generate a real one with: openssl rand -base64 48
 */

export const MIN_AUTH_SECRET_BYTES = 32;

/** Values that appeared in the repository (the pre-v1.1.1 .env.example and the dev fallback): never valid in production. */
const PUBLISHED_SECRETS: readonly string[] = ["dev-only-change-me-0123456789abcdef"];
const DEV_FALLBACK = PUBLISHED_SECRETS[0];

const bytes = (s: string) => new TextEncoder().encode(s);

/** Why `value` cannot be a production AUTH_SECRET, or null when it can. */
export function authSecretProblem(value: string | undefined | null): string | null {
  if (!value || !value.trim()) return "AUTH_SECRET is not set";
  if (bytes(value).length < MIN_AUTH_SECRET_BYTES) return `AUTH_SECRET is shorter than ${MIN_AUTH_SECRET_BYTES} bytes`;
  if (PUBLISHED_SECRETS.includes(value.trim())) return "AUTH_SECRET is a published example value";
  return null;
}

const isProduction = () => process.env.NODE_ENV === "production";

function fail(problem: string): never {
  throw new Error(`${problem}. Session tokens signed with a missing, short or published key can be forged. Set AUTH_SECRET to a random value of at least ${MIN_AUTH_SECRET_BYTES} bytes, e.g. \`openssl rand -base64 48\`.`);
}

/** Startup check: throws in production when AUTH_SECRET is missing, shorter than 32 bytes, or a published value. */
export function assertAuthSecret(): void {
  const problem = authSecretProblem(process.env.AUTH_SECRET);
  if (problem && isProduction()) fail(problem);
}

const g = globalThis as unknown as { __cioAuthSecretWarned?: boolean };

/** The signing key. Production: only a valid AUTH_SECRET (else throws). Elsewhere: AUTH_SECRET, or the dev-only fallback, with a one-time warning. */
export function authSecretKey(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  const problem = authSecretProblem(value);
  if (!problem) return bytes(value!);
  if (isProduction()) fail(problem);
  const set = !!value && !!value.trim();
  if (!g.__cioAuthSecretWarned) {
    g.__cioAuthSecretWarned = true;
    console.warn(
      `[auth] ${problem}: ${set ? "accepted outside production only" : "using a fixed development key"}. ` +
        "Production refuses to start without a strong AUTH_SECRET (openssl rand -base64 48).",
    );
  }
  return bytes(set ? value! : DEV_FALLBACK);
}
