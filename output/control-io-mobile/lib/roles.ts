/**
 * Who may do what (API.md "Roles and access"). The server enforces all of
 * this; these helpers only decide what the app offers, so a hidden button is
 * never the only guard.
 *
 * Inputs are optional on purpose: sessions stored by builds before v1.1 have
 * no roles until GET /api/company answers, and projects from an older server
 * have no `access`. Unknown means "behave like v1" (own-org writer).
 */
import type { OrderKind, OrgRole, ProjectAccess, UserRole } from "./api";
import { useLive } from "./live";
import { useSession } from "./session";

export interface RoleInput {
  /** the user's role in their own org */
  role?: UserRole | null;
  /** the user's org kind */
  orgRole?: OrgRole | null;
  /** effective access to the current project (profile.access / ProjectSummary.access) */
  access?: ProjectAccess | null;
  /** profile.canOrder from the server, when loaded: wins over the derivation */
  canOrder?: boolean | null;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  supervisor: "Supervisor",
  viewer: "Viewer",
};

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  developer: "Developer",
  lender: "Lender",
  authority: "Inspector",
  insurer: "Insurer",
  contractor: "Contractor",
};

export function roleLabel(role?: UserRole | null) {
  return role ? (ROLE_LABELS[role] ?? role) : "Member";
}

export function orgRoleLabel(orgRole?: OrgRole | null) {
  return orgRole ? (ORG_ROLE_LABELS[orgRole] ?? orgRole) : "Company";
}

/** "Lender · Owner" - the role tag on Home and Company. */
export function roleTag(i: Pick<RoleInput, "role" | "orgRole">) {
  return [i.orgRole ? orgRoleLabel(i.orgRole) : null, i.role ? roleLabel(i.role) : null].filter(Boolean).join(" · ");
}

export function isViewer(i: Pick<RoleInput, "role">) {
  return i.role === "viewer";
}

/** Inspector persona: an authority org (building control). */
export function isInspector(i: Pick<RoleInput, "orgRole">) {
  return i.orgRole === "authority";
}

/** May place an inspection order on this project. */
export function canOrder(i: RoleInput): boolean {
  if (typeof i.canOrder === "boolean") return i.canOrder;
  if (i.role === "viewer") return false;
  return (i.access ?? "write") !== "read";
}

/** May edit the company profile (owners only, own org). */
export function canEditCompany(i: Pick<RoleInput, "role">): boolean {
  return i.role === "owner";
}

/** May upload flights / documents and generate reports: own org, not a viewer. */
export function canGenerateReport(i: Pick<RoleInput, "role" | "access">): boolean {
  if (i.role === "viewer") return false;
  return (i.access ?? "write") === "write";
}

/** Uploads follow the same rule as report generation. */
export const canUpload = canGenerateReport;

/** Pre-selected order kind: inspectors re-check findings, everyone else orders a full inspection. */
export function defaultKind(orgRole?: OrgRole | null): OrderKind {
  return orgRole === "authority" ? "revision" : "full";
}

/** Label for the raised centre tab button. */
export function orderButtonLabel(orgRole?: OrgRole | null): string {
  return orgRole === "authority" ? "Revision" : "Order";
}

/**
 * Why ordering is unavailable, for the explanation sheet (null when it is
 * available). `orgName` personalises who to ask.
 */
export function orderBlockedReason(i: RoleInput, orgName?: string | null): { title: string; body: string } | null {
  if (canOrder(i)) return null;
  const who = orgName ? `an owner or supervisor at ${orgName}` : "an owner or supervisor in your company";
  if (i.role === "viewer") {
    return {
      title: "Viewers track, they don't order",
      body: `Your account can follow inspections and open every report, but ordering is for owners and supervisors. Ask ${who} to order one, or to change your role.`,
    };
  }
  return {
    title: "This project is shared read-only",
    body: "The project's owner shared it with your company for tracking only. Ask them to share it with ordering access, or to order the inspection themselves.",
  };
}

/**
 * Everything a screen needs to gate actions for the signed-in user on the
 * current project, from the session (roles) and the live profile (access,
 * canOrder). Use inside SessionProvider + LiveProvider.
 */
export function useRoles() {
  const { role, orgRole, project, company, user } = useSession();
  const { profile } = useLive();
  const access: ProjectAccess | null = profile?.access ?? project?.access ?? null;
  const input: RoleInput = { role, orgRole, access, canOrder: profile?.canOrder ?? null };
  return {
    role,
    orgRole,
    access,
    /** project belongs to another org and is shared with ours */
    shared: profile?.shared ?? project?.shared ?? false,
    isViewer: isViewer(input),
    isInspector: isInspector(input),
    canOrder: canOrder(input),
    canEditCompany: canEditCompany(input),
    canGenerateReport: canGenerateReport(input),
    canUpload: canUpload(input),
    defaultKind: defaultKind(orgRole),
    /** centre tab button label: "Order" or "Revision" */
    orderLabel: orderButtonLabel(orgRole),
    /** "Lender · Owner" */
    roleTag: roleTag(input),
    /** explanation sheet copy when ordering is unavailable, else null */
    orderBlocked: orderBlockedReason(input, company?.name ?? user?.org?.name),
  };
}
