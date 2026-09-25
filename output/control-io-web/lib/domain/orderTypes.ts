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
  /** Required when priority = "scheduled": ISO-8601 date-time with a zone, >= 3 h from now, starting 09:00-17:00 Yerevan time (SLOT_FIRST_HOUR..SLOT_LAST_HOUR). */
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
/**
 * Daylight flying only: a scheduled slot (the start of its 1 h arrival
 * window) must be between SLOT_FIRST_HOUR:00 and SLOT_LAST_HOUR:00
 * Asia/Yerevan time, both inclusive. The API rejects other starts with 400.
 */
export const SLOT_FIRST_HOUR = 9;
export const SLOT_LAST_HOUR = 17;
