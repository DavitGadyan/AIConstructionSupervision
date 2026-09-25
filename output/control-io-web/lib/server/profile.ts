/**
 * Company profile (GET/PATCH /api/company) and the project profile the
 * mobile app's Home and Project screens are built from
 * (GET /api/projects/:id/profile). See API.md "On-demand inspections (v1.1)".
 */
import { z } from "zod";
import { db } from "./db";
import { fileUrl } from "./storage";
import { HttpError, projectForSession, type Session } from "./auth";
import { projectSummary } from "./queries";
import { activeOrderFor, PHONE_RE } from "./orders";
import { severityFor } from "../domain/schedule";
import { ORG_ROLES, USER_ROLES, type CompanyDto, type OrgRole, type ProjectProfileDto, type UserRole } from "../domain/orderTypes";

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

const asOrgRole = (r: string): OrgRole => ((ORG_ROLES as readonly string[]).includes(r) ? (r as OrgRole) : "developer");
const asUserRole = (r: string): UserRole => ((USER_ROLES as readonly string[]).includes(r) ? (r as UserRole) : "viewer");

/** A logo key is either a public path ("/images/…") or a storage key. */
const logoUrl = (key: string | null) => (!key ? null : key.startsWith("/") ? key : fileUrl(key));

export async function getCompany(s: Pick<Session, "orgId">): Promise<CompanyDto> {
  const org = await db.org.findUnique({ where: { id: s.orgId }, include: { users: { orderBy: { createdAt: "asc" } } } });
  if (!org) throw new HttpError(404, "Company not found");
  return {
    id: org.id,
    name: org.name,
    legalName: org.legalName,
    taxId: org.taxId,
    address: org.address,
    phone: org.phone,
    email: org.email,
    website: org.website,
    logoUrl: logoUrl(org.logoKey),
    role: asOrgRole(org.role),
    members: org.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: asUserRole(u.role) })),
  };
}

/** Optional text field: "" clears it (stored as null). */
const optText = (max: number) => z.string().trim().max(max).optional();

export const CompanyPatchSchema = z.strictObject({
  name: z.string().trim().min(1, "Required").max(120).optional(),
  legalName: optText(200),
  taxId: optText(40),
  address: optText(300),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || (PHONE_RE.test(v) && (v.match(/\d/g)?.length ?? 0) >= 6), "Use digits, spaces and + - ( ), 6-20 characters")
    .optional(),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Not a valid email address")
    .optional(),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i.test(v), "Not a valid website address")
    .optional(),
});
export type CompanyPatchBody = z.infer<typeof CompanyPatchSchema>;

export async function patchCompany(s: Pick<Session, "orgId" | "role">, patch: CompanyPatchBody): Promise<CompanyDto> {
  if (s.role !== "owner") throw new HttpError(403, "Only a company owner can edit the company profile");
  const data: Record<string, string | null> = {};
  if (patch.name !== undefined) data.name = patch.name;
  for (const k of ["legalName", "taxId", "address", "phone", "email"] as const) {
    if (patch[k] !== undefined) data[k] = patch[k] === "" ? null : patch[k]!;
  }
  if (patch.website !== undefined) data.website = patch.website === "" ? null : /^https?:\/\//i.test(patch.website) ? patch.website : `https://${patch.website}`;
  if (Object.keys(data).length) await db.org.update({ where: { id: s.orgId }, data });
  return getCompany(s);
}

// ---------------------------------------------------------------------------
// Project profile
// ---------------------------------------------------------------------------

export async function projectProfile(s: Session, projectId: string): Promise<ProjectProfileDto> {
  const project = await projectForSession(projectId, s, "read");
  const summary = await projectSummary(project.id);
  const [cover, documents, reports] = await Promise.all([
    summary.latestFlight ? db.shot.findFirst({ where: { flightId: summary.latestFlight.id, view: "orbit" }, orderBy: { createdAt: "asc" } }) : null,
    db.document.findMany({ where: { projectId: project.id }, orderBy: { uploadedAt: "desc" }, take: 5 }),
    db.report.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  const daysBehind = summary.variance?.daysBehind ?? 0;
  const canOrder = (project.access === "write" || project.access === "order") && s.role !== "viewer";
  return {
    project: {
      id: project.id,
      name: project.name,
      address: project.address,
      lat: project.lat,
      lng: project.lng,
      developer: project.developer,
      contractor: project.contractor,
      lender: project.lender,
      permitNo: project.permitNo,
      buildingType: project.buildingType,
      floorsTotal: project.floorsTotal,
      floorHeightM: project.floorHeightM,
      grossAreaM2: project.grossAreaM2,
      units: project.units,
      startDate: project.startDate.toISOString(),
      plannedCompletion: project.plannedCompletion.toISOString(),
      coverUrl: cover ? fileUrl(cover.fileKey) : null,
    },
    status: {
      daysBehind,
      severity: severityFor(daysBehind),
      earnedPct: summary.variance?.earnedPct ?? 0,
      plannedPct: summary.variance?.plannedPct ?? 0,
      lastFlightAt: summary.latestFlight ? new Date(summary.latestFlight.capturedAt).toISOString() : null,
      openFindings: summary.findings.length,
    },
    recentDocuments: documents.map((d) => ({
      id: d.id,
      kind: d.kind,
      title: d.title,
      pages: d.pages,
      issuedAt: d.issuedAt ? d.issuedAt.toISOString() : null,
      uploadedAt: d.uploadedAt.toISOString(),
      url: fileUrl(d.fileKey),
    })),
    recentReports: reports.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), daysBehind: r.daysBehind, url: fileUrl(r.fileKey) })),
    activeOrder: await activeOrderFor(project.id, { orgId: s.orgId, role: s.role, access: project.access }),
    shared: project.shared,
    access: project.access,
    canOrder,
  };
}
