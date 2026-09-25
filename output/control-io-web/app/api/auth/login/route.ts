import { cookies } from "next/headers";
import { SESSION_COOKIE, signSession, verifyLogin, type Session } from "@/lib/server/auth";
import { ORG_ROLES, USER_ROLES, type OrgRole, type UserRole } from "@/lib/domain/orderTypes";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const user = await verifyLogin(String(body.email ?? ""), String(body.password ?? ""));
  if (!user) return Response.json({ error: "Wrong email or password" }, { status: 401 });
  const role: UserRole = (USER_ROLES as readonly string[]).includes(user.role) ? (user.role as UserRole) : "viewer";
  const orgRole: OrgRole = (ORG_ROLES as readonly string[]).includes(user.org.role) ? (user.org.role as OrgRole) : "developer";
  const session: Session = { userId: user.id, orgId: user.orgId, name: user.name, email: user.email, role, orgRole };
  const token = await signSession(session);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return Response.json({ token, user: { id: user.id, name: user.name, email: user.email, role, org: { id: user.org.id, name: user.org.name, role: orgRole } } });
}
