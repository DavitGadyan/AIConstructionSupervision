/**
 * Server-only: what the caller may do with inspections on a project, and the
 * project's active order (advanced to now). Cached per request so the shell
 * (layout) and the page share one lookup.
 */
import { cache } from "react";
import { projectForSession, type Session } from "@/lib/server/auth";
import { activeOrderFor } from "@/lib/server/orders";
import type { UserRole } from "@/lib/domain/orderTypes";

const load = cache(async (projectId: string, orgId: string, role: UserRole) => {
  const project = await projectForSession(projectId, { orgId, role }, "read");
  const canOrder = (project.access === "write" || project.access === "order") && role !== "viewer";
  const active = await activeOrderFor(projectId, { orgId, role, access: project.access });
  return { project, access: project.access, shared: project.shared, canOrder, active };
});

export function orderContext(projectId: string, s: Pick<Session, "orgId" | "role">) {
  return load(projectId, s.orgId, s.role);
}

export type OrderContext = Awaited<ReturnType<typeof orderContext>>;
