/**
 * REST client for the control.io web backend. Contract: ../control-io-web/API.md
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000").replace(/\/+$/, "");

// ---------- order contract (verbatim copy) ----------
// BEGIN verbatim copy of control-io-web/lib/domain/orderTypes.ts - do not edit here;
// change the web file and re-copy (diff the two blocks to check they match).
/**
 * Wire types for on-demand inspections (API.md "On-demand inspections (v1.1)").
 *
 * Shared by the server (lib/server/*, app/api/*), the web app and - copied
 * verbatim - the Expo app. Keep this file dependency-free (no imports, no
 * Node/React APIs) so the copy compiles on both sides. Dates are ISO-8601
 * strings on the wire.
 */

// ---------------------------------------------------------------------------
// Enums (tuples first so zod can use them: z.enum(ORDER_KINDS))
// ---------------------------------------------------------------------------

export const ORDER_KINDS = ["full", "revision", "targeted"] as const;
/** full = whole building (all facades + nadir + 3D); revision = re-inspection of open findings; targeted = specific floors/issues. */
export type OrderKind = (typeof ORDER_KINDS)[number];

export const ORDER_PRIORITIES = ["asap", "scheduled"] as const;
export type OrderPriority = (typeof ORDER_PRIORITIES)[number];

export const ORDER_STATUSES = [
  "requested",
  "confirmed",
  "dispatched",
  "on_site",
  "flying",
  "processing",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** An event row is a reached status, or the single "delayed" notice after repeated delivery failures (status stays "processing"). */
export type OrderEventStatus = OrderStatus | "delayed";

export const ORG_ROLES = ["developer", "lender", "authority", "insurer", "contractor"] as const;
/** What kind of company an org is. "authority" orgs are the inspector persona (default order kind: revision). */
export type OrgRole = (typeof ORG_ROLES)[number];

export const USER_ROLES = ["owner", "supervisor", "viewer"] as const;
/** A user's role inside their own org. Viewers only track; owners can also edit the company profile. */
export type UserRole = (typeof USER_ROLES)[number];

export const SHARE_ACCESS = ["read", "order"] as const;
/** Access an org has to a project another org shared with it (ProjectShare.access). */
export type ShareAccess = (typeof SHARE_ACCESS)[number];

/** The caller's effective access to a project: "write" = own org (non-viewer), "order" = may order inspections, "read" = track only. */
export type ProjectAccess = "read" | "order" | "write";

/** Schedule health bucket from daysBehind (<=2, <=7, <=21, >21). */
export type ProjectStatusLevel = "on-track" | "watch" | "late" | "critical";

// ---------------------------------------------------------------------------
// Status constants
// ---------------------------------------------------------------------------

/** The happy-path progression, in order ("cancelled" is terminal and off this path). */
export const STATUS_ORDER = [
  "requested",
  "confirmed",
  "dispatched",
  "on_site",
  "flying",
  "processing",
  "delivered",
] as const satisfies readonly OrderStatus[];

/** Not delivered and not cancelled: at most one such order per project (else 409). */
export const ACTIVE_STATUSES = [
  "requested",
  "confirmed",
  "dispatched",
  "on_site",
  "flying",
  "processing",
] as const satisfies readonly OrderStatus[];

/** An order can be cancelled only before the crew is on site (else 409). */
export const CANCELLABLE_STATUSES = ["requested", "confirmed", "dispatched"] as const satisfies readonly OrderStatus[];

export const TERMINAL_STATUSES = ["delivered", "cancelled"] as const satisfies readonly OrderStatus[];

export function isActiveStatus(s: string): s is (typeof ACTIVE_STATUSES)[number] {
  return (ACTIVE_STATUSES as readonly string[]).includes(s);
}

/** Position on the happy path (0 = requested ... 6 = delivered); -1 for "cancelled". */
export function statusIndex(s: OrderStatus): number {
  return (STATUS_ORDER as readonly string[]).indexOf(s);
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface Crew {
  vehicle: string; // "Toyota Hilux · drone unit 1"
  plate: string; // "00 AA 001"
  pilot: string; // "Drone unit 1"
  pilotPhone: string; // "+374 …"
  drone: string; // "DJI Matrice 4E"
}

export interface OrderEventDto {
  at: string;
  status: OrderEventStatus;
  message: string;
}

/** `Order` in API.md. Timestamps are null until known; eta* and reportDueAt are estimates until reached. */
export interface OrderDto {
  id: string;
  number: string; // "INS-2026-0007"
  projectId: string;
  projectName: string;
  projectAddress: string;
  /** The ordering org (project owner org, or an org the project is shared with). */
  orgId: string;
  kind: OrderKind;
  priority: OrderPriority;
  status: OrderStatus;
  createdAt: string;
  scheduledFor: string | null;
  /** Arrival window. ASAP: +3 h / +4 h from confirmation; scheduled: [scheduledFor, +1 h]. */
  etaArrivalFrom: string | null;
  etaArrivalTo: string | null;
  arrivedAt: string | null;
  flightStartedAt: string | null;
  flightEndedAt: string | null;
  /** flightEndedAt + 12 h (estimated before the flight). */
  reportDueAt: string | null;
  deliveredAt: string | null;
  reportId: string | null;
  reportUrl: string | null; // "/api/files/…" (PDF)
  crew: Crew | null; // assigned at dispatch
  contactName: string;
  contactPhone: string;
  accessNotes: string | null;
  focus: string[];
  requestedBy: { id: string; name: string };
  events: OrderEventDto[]; // oldest first
  /** Price quoted when the order was placed (AMD, paid by invoice). */
  priceAmd: number;
  /** True when the caller may cancel this order right now. */
  canCancel: boolean;
  /** DISPATCH_TIME_SCALE frozen at creation (1 = real time, 240 = demo: 1 h ≈ 15 s). Clients divide durations by it for countdown estimates. */
  timeScale: number;
}

export interface MemberDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface CompanyDto {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  role: OrgRole;
  members: MemberDto[];
}

/** PATCH /api/company body (owner only). Any subset; empty string clears an optional field. */
export type CompanyPatch = Partial<
  Pick<CompanyDto, "name" | "legalName" | "taxId" | "address" | "phone" | "email" | "website">
>;

export interface ProjectProfileDto {
  project: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    developer: string;
    contractor: string | null;
    lender: string | null;
    permitNo: string | null;
    buildingType: string | null;
    floorsTotal: number;
    floorHeightM: number;
    grossAreaM2: number | null;
    units: number | null;
    startDate: string;
    plannedCompletion: string;
    coverUrl: string | null;
  };
  status: {
    daysBehind: number;
    severity: ProjectStatusLevel;
    earnedPct: number;
    plannedPct: number;
    lastFlightAt: string | null;
    openFindings: number;
  };
  /** Newest 5. */
  recentDocuments: {
    id: string;
    kind: string; // schedule | permit | contract | other
    title: string;
    pages: number;
    issuedAt: string | null;
    uploadedAt: string;
    url: string;
  }[];
  /** Newest 3. */
  recentReports: { id: string; createdAt: string; daysBehind: number; url: string }[];
  activeOrder: OrderDto | null;
  /** True when the project belongs to another org and is shared with the caller's org. */
  shared: boolean;
  /** The caller's effective access (see roles matrix in API.md). */
  access: ProjectAccess;
  /** access is "write" or "order" and the caller is not a viewer. */
  canOrder: boolean;
}

/** GET /api/orders/quote?kind=&priority= */
export interface QuoteDto {
  kind: OrderKind;
  priority: OrderPriority;
  priceAmd: number;
  currency: "AMD";
  includes: string[];
  /** Car + drone on site this many hours after confirmation (ASAP). */
  etaHours: [number, number];
  /** Independent PDF report within this many hours after the flight. */
  reportHours: number;
}

/** POST /api/orders body. */
export interface CreateOrderInput {
  projectId: string;
  kind: OrderKind;
  priority: OrderPriority;
  /** Required when priority = "scheduled"; must be >= 3 h from now. ISO-8601. */
  scheduledFor?: string | null;
  contactName: string;
  contactPhone: string;
  accessNotes?: string;
  focus?: string[];
}

/** Error body for every non-2xx response. `activeOrderId` is set on 409 from POST /api/orders. */
export interface ApiErrorDto {
  error: string;
  activeOrderId?: string;
  issues?: { path: string; message: string }[];
}

// ---------------------------------------------------------------------------
// Promise shown to customers (single source for copy + quote)
// ---------------------------------------------------------------------------

/** ASAP: car + drone on site 3-4 h after confirmation. */
export const ETA_HOURS: [number, number] = [3, 4];
/** Independent PDF report within 12 h of the flight. */
export const REPORT_HOURS = 12;
/** Scheduled orders must be at least this far in the future. */
export const MIN_SCHEDULE_LEAD_HOURS = 3;
// END verbatim copy of control-io-web/lib/domain/orderTypes.ts

// ---------- types ----------

export type ProjectStatus = "on-track" | "watch" | "late" | "critical";

// Friendly names for the contract DTOs above (what screens import).
export type Order = OrderDto;
export type OrderEvent = OrderEventDto;
export type Company = CompanyDto;
export type Member = MemberDto;
export type ProjectProfile = ProjectProfileDto;
export type Quote = QuoteDto;
export type ProjectDocumentSummary = ProjectProfileDto["recentDocuments"][number];
export type ReportSummary = ProjectProfileDto["recentReports"][number];

/**
 * The signed-in user as returned by POST /api/auth/login.
 * `role` and `org.role` arrived in v1.1: sessions stored by older builds lack
 * them, so both are optional here and the session fills them in from
 * GET /api/company (see lib/session.tsx).
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role?: UserRole;
  org: { id: string; name: string; role?: OrgRole };
}

export interface ProjectSummary {
  id: string;
  name: string;
  address: string;
  developer: string;
  floorsTotal: number;
  daysBehind: number;
  plannedPct: number;
  earnedPct: number;
  spi: number;
  lastFlightAt: string | null;
  coverUrl: string | null;
  status: ProjectStatus;
  /** v1.1: true when another org shares this project with the caller's org. Missing on older servers. */
  shared?: boolean;
  /** v1.1: the caller's effective access. Missing on older servers (treat as "write"). */
  access?: ProjectAccess;
}

export interface PhaseVariance {
  phase: string;
  plannedPct: number;
  earnedPct: number;
}

export interface Finding {
  id: string;
  floor: number;
  phase: string;
  plannedPct: number;
  observedPct: number;
  daysBehind: number;
  severity: string;
  plannedEnd: string;
  evidence: string[];
}

export interface TimelineItem {
  floor: number;
  phase: string;
  plannedStart: string;
  plannedEnd: string;
  actualPct: number;
}

export interface ProjectDashboard {
  project: {
    id: string;
    name: string;
    address: string;
    developer: string;
    permitNo?: string;
    floorsTotal: number;
    floorHeightM?: number;
    startDate?: string;
    plannedCompletion?: string;
    lat?: number;
    lng?: number;
  };
  latestFlight: {
    id: string;
    capturedAt: string;
    status: string;
    meshUrl: string | null;
    floorsDetected: number;
    shotCount: number;
  } | null;
  variance: {
    at: string;
    plannedPct: number;
    earnedPct: number;
    earnedScheduleDate?: string;
    daysBehind: number;
    spi: number;
    byPhase: PhaseVariance[];
  } | null;
  plannedFloors?: number;
  findings: Finding[];
  floors?: unknown[];
  timeline: TimelineItem[];
}

export interface Shot {
  id: string;
  url: string;
  thumbUrl?: string | null;
  view?: string;
  label?: string;
  capturedAt?: string;
  lat?: number | null;
  lng?: number | null;
  altM?: number | null;
  sha256?: string | null;
}

export interface Flight {
  id: string;
  capturedAt: string;
  status: string;
  source?: string;
  pilot?: string | null;
  drone?: string | null;
  meshUrl?: string | null;
  floorsDetected?: number | null;
  daysBehind?: number | null;
  shots: Shot[];
}

export interface Report {
  id: string;
  createdAt: string;
  daysBehind: number;
  pages: number;
  sha256?: string;
  url: string;
}

/** GET /api/projects/:id/documents row. */
export interface ProjectDocument {
  id: string;
  kind: string; // schedule | permit | contract | other
  title: string;
  pages: number;
  sha256?: string | null;
  status?: string;
  issuer?: string | null;
  issuedAt: string | null;
  uploadedAt: string;
  url: string;
  milestoneCount?: number;
}

// ---------- plumbing ----------

export class ApiError extends Error {
  status: number;
  /** Parsed JSON error body when the server sent one (`{ error, activeOrderId?, issues? }`). */
  body?: ApiErrorDto;
  constructor(status: number, message: string, body?: ApiErrorDto) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
  /** 409 from POST /api/orders: the order already running on this project. */
  get activeOrderId(): string | undefined {
    return this.body?.activeOrderId;
  }
  /** 400 validation issues keyed by field path ("contactPhone", "scheduledFor", ...). */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const i of this.body?.issues ?? []) if (i.path && !out[i.path]) out[i.path] = i.message;
    return out;
  }
}

export function isApiError(e: unknown, status?: number): e is ApiError {
  return e instanceof ApiError && (status === undefined || e.status === status);
}

/** A human sentence for any thrown value (ApiError messages come from the server). */
export function errorMessage(e: unknown, fallback = "Something went wrong."): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  return fallback;
}

/** Resolve a server-relative path ("/api/files/...") against API_URL. */
export function absoluteUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^(https?:|data:|blob:|file:)/.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function authHeaders(token: string | null | undefined): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** expo-image source for an authenticated file. */
export function imageSource(path: string | null | undefined, token: string | null | undefined) {
  const uri = absoluteUrl(path);
  return uri ? { uri, headers: authHeaders(token) } : undefined;
}

async function request<T>(
  path: string,
  token: string | null,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(absoluteUrl(path)!, {
      ...rest,
      headers: {
        Accept: "application/json",
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...authHeaders(token),
        ...(headers as Record<string, string> | undefined),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, `Can't reach ${API_URL}. Check your connection.`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const body = data && typeof data === "object" ? (data as ApiErrorDto) : undefined;
    const msg = body?.error ? String(body.error) : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, body);
  }
  return data as T;
}

// ---------- endpoints ----------

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", null, {
      method: "POST",
      json: { email, password },
    }),
  logout: (token: string) => request<void>("/api/auth/logout", token, { method: "POST" }),
  projects: (token: string) => request<ProjectSummary[]>("/api/projects", token),
  project: (token: string, id: string) => request<ProjectDashboard>(`/api/projects/${id}`, token),
  flights: (token: string, id: string) => request<Flight[]>(`/api/projects/${id}/flights`, token),
  reports: (token: string, id: string) => request<Report[]>(`/api/projects/${id}/reports`, token),
  generateReport: (token: string, id: string, flightId?: string) =>
    request<{ id: string; url: string }>(`/api/projects/${id}/reports`, token, {
      method: "POST",
      json: flightId ? { flightId } : {},
    }),
  documents: (token: string, id: string) => request<ProjectDocument[]>(`/api/projects/${id}/documents`, token),

  // ---- v1.1: company, project profile, on-demand inspections ----
  company: (token: string) => request<Company>("/api/company", token),
  /** Owner only (403 otherwise). Empty string clears an optional field. */
  updateCompany: (token: string, patch: CompanyPatch) =>
    request<Company>("/api/company", token, { method: "PATCH", json: patch }),
  projectProfile: (token: string, id: string) => request<ProjectProfile>(`/api/projects/${id}/profile`, token),
  /** Newest first. Without projectId: every project the caller can read. */
  orders: (token: string, projectId?: string) =>
    request<Order[]>(projectId ? `/api/orders?projectId=${encodeURIComponent(projectId)}` : "/api/orders", token),
  order: (token: string, id: string) => request<Order>(`/api/orders/${encodeURIComponent(id)}`, token),
  /** 201 Order | 400 issues | 403 viewer/read-only | 409 { activeOrderId } | 422 outside service area. */
  createOrder: (token: string, input: CreateOrderInput) =>
    request<Order>("/api/orders", token, { method: "POST", json: input }),
  /** 200 cancelled Order | 409 once the crew is on site | 403 per roles matrix. */
  cancelOrder: (token: string, id: string) =>
    request<Order>(`/api/orders/${encodeURIComponent(id)}/cancel`, token, { method: "POST", json: {} }),
  quote: (token: string, kind: OrderKind, priority: OrderPriority) =>
    request<Quote>(`/api/orders/quote?kind=${kind}&priority=${priority}`, token),
};

export function liveUrl(projectId: string, token: string) {
  return `${API_URL}/api/projects/${projectId}/live?token=${encodeURIComponent(token)}`;
}

export function embedModelUrl(projectId: string, token: string, flightId?: string) {
  const q = new URLSearchParams({ token });
  if (flightId) q.set("flight", flightId);
  return `${API_URL}/embed/model/${projectId}?${q.toString()}`;
}

// ---------- upload ----------

export interface UploadFile {
  uri: string;
  name: string;
  type: string;
  /** web only: the picked File object */
  file?: Blob;
}

export interface UploadFields {
  capturedAt?: string;
  pilot?: string;
  drone?: string;
  lat?: number;
  lng?: number;
  altM?: number;
}

/**
 * Multipart upload with progress. XMLHttpRequest instead of fetch because
 * fetch exposes no upload progress in React Native.
 */
export function uploadFlight(
  token: string,
  projectId: string,
  files: UploadFile[],
  fields: UploadFields,
  onProgress: (fraction: number) => void,
): Promise<{ id: string; status: string }> {
  const form = new FormData();
  for (const f of files) {
    if (f.file) form.append("files[]", f.file as Blob, f.name);
    // React Native's FormData accepts { uri, name, type } descriptors.
    else form.append("files[]", { uri: f.uri, name: f.name, type: f.type } as unknown as Blob);
  }
  form.append("source", "mobile");
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null && v !== "") form.append(k, String(v));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/projects/${projectId}/flights`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: any = undefined;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        body = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve(body ?? { id: "", status: "uploaded" });
      } else {
        reject(new ApiError(xhr.status, body?.error ?? `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, `Can't reach ${API_URL}. Check your connection.`));
    xhr.send(form);
  });
}
