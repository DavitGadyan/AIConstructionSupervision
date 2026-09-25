import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Project } from "@prisma/client";
import { db, isTransientDbError } from "./db";
import { authSecretKey } from "./authSecret";
import { ORG_ROLES, USER_ROLES, type OrgRole, type ProjectAccess, type UserRole } from "../domain/orderTypes";

export const SESSION_COOKIE = "cio_session";
/** AUTH_SECRET; production refuses a missing, short or published key (lib/server/authSecret.ts). */
const secret = () => authSecretKey();

export interface Session {
  userId: string;
  orgId: string;
  name: string;
  email: string;
  /** The user's role in their own org. */
  role: UserRole;
  /** What kind of company the user's org is. */
  orgRole: OrgRole;
}

const asUserRole = (r: unknown): UserRole => ((USER_ROLES as readonly string[]).includes(String(r)) ? (r as UserRole) : "viewer");
const asOrgRole = (r: unknown): OrgRole => ((ORG_ROLES as readonly string[]).includes(String(r)) ? (r as OrgRole) : "developer");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyLogin(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() }, include: { org: true } });
  if (!user) return null;
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;
  return user;
}

export async function signSession(s: Session) {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function readToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.userId),
      orgId: String(payload.orgId),
      name: String(payload.name),
      email: String(payload.email),
      // Tokens issued before v1.1 carry no roles; requireSession/requireApiSession refresh them from the DB.
      role: asUserRole(payload.role),
      orgRole: asOrgRole(payload.orgRole),
    };
  } catch {
    return null;
  }
}

/** Session from Bearer header, `?token=` (EventSource / WebView), or cookie. Claims only - not checked against the DB. */
export async function getSession(req?: Request): Promise<Session | null> {
  if (req) {
    const auth = req.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) return readToken(auth.slice(7));
    const t = new URL(req.url).searchParams.get("token");
    if (t) return readToken(t);
  } else {
    const h = await headers();
    const auth = h.get("authorization");
    if (auth?.startsWith("Bearer ")) return readToken(auth.slice(7));
  }
  const c = await cookies();
  return readToken(c.get(SESSION_COOKIE)?.value);
}

/**
 * The session with role, org and org role re-read from the database (the
 * source of truth: roles may change after the token was issued), or null
 * when the user no longer exists (e.g. after a reseed).
 */
export async function refreshSession(s: Session | null): Promise<Session | null> {
  if (!s) return null;
  const u = await db.user.findUnique({ where: { id: s.userId }, select: { id: true, name: true, email: true, role: true, orgId: true, org: { select: { role: true } } } });
  if (!u) return null;
  return { userId: u.id, orgId: u.orgId, name: u.name, email: u.email, role: asUserRole(u.role), orgRole: asOrgRole(u.org.role) };
}

export async function requireSession(): Promise<Session> {
  const s = await refreshSession(await getSession());
  // A valid token for a user that no longer exists (e.g. after a reseed) is a signed-out user.
  if (!s) redirect("/login");
  return s;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function requireApiSession(req: Request): Promise<Session> {
  const s = await refreshSession(await getSession(req));
  if (!s) throw new HttpError(401, "Not signed in");
  return s;
}

// ---------------------------------------------------------------------------
// Project access (API.md "Roles and access")
// ---------------------------------------------------------------------------

const RANK: Record<ProjectAccess, number> = { read: 0, order: 1, write: 2 };

export type ProjectForSession = Project & {
  /** The caller's effective access. */
  access: ProjectAccess;
  /** The project belongs to another org and is shared with the caller's org. */
  shared: boolean;
};

/**
 * The caller's effective access to a project, or null when the caller's org
 * can neither own nor see it:
 * - own org: "write" ("read" for viewers)
 * - shared with the caller's org: the share's access ("read" for viewers)
 */
export function accessFor(
  project: { orgId: string },
  share: { access: string } | null | undefined,
  s: Pick<Session, "orgId" | "role">,
): { access: ProjectAccess; shared: boolean } | null {
  const viewer = s.role === "viewer";
  if (project.orgId === s.orgId) return { access: viewer ? "read" : "write", shared: false };
  if (!share) return null;
  const access: ProjectAccess = share.access === "order" && !viewer ? "order" : "read";
  return { access, shared: true };
}

/** Access for many projects at once (list endpoints). Unreadable projects are absent from the map. */
export async function accessMap(projectIds: string[], s: Pick<Session, "orgId" | "role">) {
  const ids = [...new Set(projectIds)];
  const [projects, shares] = await Promise.all([
    db.project.findMany({ where: { id: { in: ids } }, select: { id: true, orgId: true } }),
    db.projectShare.findMany({ where: { projectId: { in: ids }, orgId: s.orgId } }),
  ]);
  const out = new Map<string, { access: ProjectAccess; shared: boolean }>();
  for (const p of projects) {
    const a = accessFor(p, shares.find((x) => x.projectId === p.id), s);
    if (a) out.set(p.id, a);
  }
  return out;
}

/** Ids of every project the caller's org owns or has been shared (own first, oldest first). */
export async function readableProjectIds(s: Pick<Session, "orgId">): Promise<string[]> {
  const [own, shared] = await Promise.all([
    db.project.findMany({ where: { orgId: s.orgId }, select: { id: true }, orderBy: { createdAt: "asc" } }),
    db.projectShare.findMany({ where: { orgId: s.orgId }, select: { projectId: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return [...new Set([...own.map((p) => p.id), ...shared.map((x) => x.projectId)])];
}

/**
 * Loads a project the caller may use at the given level:
 * - "read": see it (owner org, or any share)
 * - "order": order inspections (owner org non-viewer, or an "order" share non-viewer)
 * - "write" (default, today's behaviour): upload / generate (owner org non-viewer)
 * Throws 404 when the caller cannot see the project at all (ids do not leak), 403 when they can see it but not act.
 */
export async function projectForSession(projectId: string, s: Pick<Session, "orgId" | "role">, need: ProjectAccess = "write"): Promise<ProjectForSession> {
  const p = await db.project.findUnique({ where: { id: projectId } });
  const share = p && p.orgId !== s.orgId ? await db.projectShare.findUnique({ where: { projectId_orgId: { projectId, orgId: s.orgId } } }) : null;
  const a = p ? accessFor(p, share, s) : null;
  if (!p || !a) throw new HttpError(404, "Project not found");
  if (RANK[a.access] < RANK[need]) {
    throw new HttpError(
      403,
      need === "order"
        ? s.role === "viewer"
          ? "Viewers can track inspections but not order them"
          : "This project is shared with your organisation read-only"
        : s.role === "viewer"
          ? "Viewers have read-only access"
          : "Only the project owner's team can do this",
    );
  }
  return Object.assign(p, a);
}

export function apiError(e: unknown) {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message, ...(e.extra ?? {}) }, { status: e.status, headers: e.status === 503 ? { "Retry-After": "2" } : undefined });
  }
  if (isTransientDbError(e)) {
    // Lock wait / pool / transaction timeout: nothing was written and a retry will most likely succeed.
    console.warn(`[api] database busy (${e.code}): ${e.message.split("\n").filter(Boolean).pop()?.slice(0, 200)}`);
    return Response.json({ error: "The service is busy, please try again in a moment" }, { status: 503, headers: { "Retry-After": "2" } });
  }
  console.error(e);
  return Response.json({ error: "Internal error" }, { status: 500 });
}

/** Parses `data` with a zod schema or throws 400 `{ error, issues: [{ path, message }] }`. */
export function validate<T>(schema: { safeParse(d: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, data: unknown, message = "Invalid request"): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const issues = r.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));
  throw new HttpError(400, issues.length ? `${message}: ${issues[0].path ? `${issues[0].path}: ` : ""}${issues[0].message}` : message, { issues });
}
