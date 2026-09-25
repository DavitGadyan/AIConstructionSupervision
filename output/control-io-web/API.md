# control.io REST API (v1)

Base URL: `NEXT_PUBLIC_SITE_URL` (dev: `http://localhost:3000`). All JSON. Dates are ISO-8601 strings.

Auth: `POST /api/auth/login` returns a token. Send `Authorization: Bearer <token>` on every other call.
The web app uses the same token in an httpOnly cookie `cio_session`.

Demo login: `demo@control.io` / `demo1234`.

## Auth
`POST /api/auth/login` `{ email, password }` → `200 { token, user: { id, name, email, role, org: { id, name, role } } }` | `401 { error }`
(v1.1: `user.role` is `owner | supervisor | viewer`; `user.org.role` is `developer | lender | authority | insurer | contractor`. See the roles matrix below.)
`POST /api/auth/logout` → `204`

## Projects
`GET /api/projects` →
```json
[{ "id": "…", "name": "Residential tower, 16 storeys", "address": "…", "developer": "…",
   "floorsTotal": 16, "daysBehind": 23, "plannedPct": 71.2, "earnedPct": 58.4, "spi": 0.9,
   "lastFlightAt": "2026-09-07T09:12:00Z", "coverUrl": "/api/files/…", "status": "late",
   "shared": false, "access": "write" }]
```
`status` is one of `on-track | watch | late | critical` (from daysBehind: ≤2, ≤7, ≤21, >21).
v1.1: the list also contains projects other orgs share with the caller's org, marked `"shared": true` with `"access": "order" | "read"`.
Own-org projects have `"shared": false` and `"access": "write"` (`"read"` for viewers).

`GET /api/projects/:id` → project dashboard summary
```json
{
  "project": { "id", "name", "address", "developer", "permitNo", "floorsTotal", "floorHeightM",
               "startDate", "plannedCompletion", "lat", "lng" },
  "latestFlight": { "id", "capturedAt", "status", "meshUrl": "/samples/tower-m8.glb" | null,
                    "floorsDetected": 12, "shotCount": 6 } | null,
  "variance": { "at", "plannedPct", "earnedPct", "earnedScheduleDate", "daysBehind", "spi",
                "byPhase": [{ "phase": "structure", "plannedPct": 94, "earnedPct": 79 }] },
  "plannedFloors": 15,              // structure floors the plan expected by the latest flight
  "findings": [{ "id", "floor": 13, "phase": "structure", "plannedPct": 100, "observedPct": 40,
                 "daysBehind": 34, "severity": "critical", "plannedEnd", "evidence": ["shotId"] }],
  "floors": [{ "floor": 1, "structure": 100, "envelope": 100, "glazing": 100, "finishes": 20,
               "plannedStructure": 100, "status": "on-track" }],
  "timeline": [{ "floor": 13, "phase": "structure", "plannedStart", "plannedEnd", "actualPct": 40 }]
}
```

## Flights & shots
`GET /api/projects/:id/flights` →
```json
[{ "id", "capturedAt", "status": "done", "source": "sample", "pilot", "drone",
   "meshUrl": "/samples/tower-m8.glb", "floorsDetected": 12, "daysBehind": 23,
   "shots": [{ "id", "url": "/api/files/…", "thumbUrl": "/api/files/…", "view": "orbit",
               "label": "Orbit SW", "capturedAt", "lat", "lng", "altM", "sha256" }] }]
```
`POST /api/projects/:id/flights` multipart/form-data: `files[]` (JPEG/PNG/WebP, EXIF GPS/time preserved; the field name `files` is accepted too), optional `capturedAt`, `pilot`, `drone`, `source=mobile|upload`.
→ `201 { id, status: "uploaded" }`. Processing (reconstruction → assessment → findings) runs async; follow it on the live stream.

`POST /api/projects/:id/flights/:flightId/captures` JSON `{ dataUrl: "data:image/png;base64,…", label }` → adds a `model-capture` shot (3D viewer screenshot used as evidence).

## Live (Server-Sent Events)
`GET /api/projects/:id/live` (`text/event-stream`, also accepts `?token=` because EventSource cannot set headers)
Events:
- `event: shot` `data: { flightId, shot }`
- `event: status` `data: { flightId, status, message }`
- `event: finding` `data: { flightId, daysBehind }`
- `event: ping` every 20 s.

## Documents
`GET /api/projects/:id/documents` → `[{ id, kind, title, pages, sha256, status, issuer, issuedAt, uploadedAt, url, milestoneCount }]`
`POST /api/projects/:id/documents` multipart: `file` (PDF), `kind` (`schedule|permit|contract|other`), `title` → `201`. Schedule PDFs are parsed by Claude into milestones (needs `ANTHROPIC_API_KEY`).

## Reports
`GET /api/projects/:id/reports` → `[{ id, createdAt, daysBehind, pages, sha256, url: "/api/files/…" }]`
`POST /api/projects/:id/reports` `{ flightId? }` (defaults to latest done flight) → `201 { id, url }` (PDF).

## Files
`GET /api/files/:key*` streams a stored file (auth required). Public sample assets live under `/samples/*`.

## Embeds
`/embed/model/:projectId?flight=<id>&token=<token>` - chrome-less 3D viewer page for mobile WebViews.

---

## On-demand inspections (v1.1)

Promise shown to customers: **ASAP order → car + drone on site in 3–4 hours (Yerevan & Kotayk service area) → independent PDF report within 12 hours of the flight.**
Fine print: daylight flying only (a scheduled slot starts between 09:00 and 17:00 Yerevan time); weather (wind, rain) and restricted airspace can move the slot, we call the site contact if so.
Kinds: `full` (whole building, all facades + nadir + 3D), `revision` (re-inspection of open findings after the developer claims they are fixed), `targeted` (specific floors/issues).
Prices are shown per order (AMD, VAT excluded, paid by invoice, no in-app payment). The price quoted at order time is frozen on the order as `priceAmd`.

Shared TypeScript types for everything below: `lib/domain/orderTypes.ts` (`OrderDto`, `CompanyDto`, `ProjectProfileDto`, `QuoteDto`, `CreateOrderInput`, …). The Expo app keeps a verbatim copy.

### Roles and access
Each user has a `role` in their own org (`owner | supervisor | viewer`); each org has a `role` (`developer | lender | authority | insurer | contractor`).
A project belongs to one org. The owner org can share it with another org via a `ProjectShare` with `access: "read" | "order"`,
which is how an inspector (an `authority` org, e.g. "Building control authority") sees and orders on a lender's project.

| Action | Own-org owner | Own-org supervisor | Own-org viewer | Shared org, `access: order` (owner/supervisor) | Shared org, `access: read` / any viewer |
|---|---|---|---|---|---|
| See project, profile, documents, reports, 3D, orders, live stream | ✓ | ✓ | ✓ | ✓ | ✓ |
| Get a quote | ✓ | ✓ | ✓ | ✓ | ✓ |
| Order an inspection (`POST /api/orders`) | ✓ | ✓ | 403 | ✓ (apps default the kind to `revision` for `authority` orgs) | 403 |
| Cancel an order (before `on_site`) | ✓ any order on the project | ✓ any order on the project | 403 | ✓ own org's orders only | 403 |
| Upload flights / documents, generate reports | ✓ | ✓ | 403 | 403 | 403 |
| `PATCH /api/company` (own org only) | ✓ | 403 | 403 | ✓ (their own company, if owner) | 403 |

- Orders are project-scoped: every org that can read the project sees all its orders (so a `409 activeOrderId` is always trackable). `orgId` on the order is the org that placed it.
- `canCancel` on each `Order` is computed for the caller from the table above and the status; clients show/hide Cancel from it and never re-derive it.
- Projects the caller cannot read → `404` (not `403`), so project ids do not leak.

### Errors
Every non-2xx response is JSON `{ error: string, … }`:

| Status | When | Body |
|---|---|---|
| `400` | Validation failed (bad kind/priority, missing or malformed phone, `scheduledFor` missing, not a date-time with a zone, < 3 h ahead or outside 09:00–17:00 Yerevan time, focus too long, …) | `{ error, issues?: [{ path, message }] }` |
| `401` | No/invalid token | `{ error }` |
| `403` | Signed in but the role/share does not allow it (viewer ordering, read-only share, non-owner PATCH company) | `{ error }` |
| `404` | Project/order not found or not visible to the caller | `{ error }` |
| `409` | `POST /api/orders` while the project already has an active order | `{ error, activeOrderId }` |
| `409` | `POST /api/orders/:id/cancel` once the crew is `on_site` or later (or already delivered/cancelled) | `{ error }` |
| `422` | Project location is outside the service area (Yerevan & Kotayk) | `{ error }` |
| `503` | Temporary: the database was busy (lock wait or timeout) and nothing was written; retry after `Retry-After` seconds | `{ error }` |

### Company profile
`GET /api/company` → `{ id, name, legalName, taxId, address, phone, email, website, logoUrl, role: "developer"|"lender"|"authority"|"insurer"|"contractor", members: [{ id, name, email, role: "owner"|"supervisor"|"viewer" }] }`
(profile fields other than `id`, `name`, `role`, `members` may be `null`).
`PATCH /api/company` (owner role only, else 403) body: any of `name, legalName, taxId, address, phone, email, website` → `200` updated company. Empty string clears an optional field. CORS allows `PATCH`.

### Project profile
`GET /api/projects/:id/profile` →
```json
{ "project": { "id", "name", "address", "lat", "lng", "developer", "contractor", "lender", "permitNo",
               "buildingType", "floorsTotal", "floorHeightM", "grossAreaM2", "units",
               "startDate", "plannedCompletion", "coverUrl" },
  "status": { "daysBehind": 28, "severity": "critical", "earnedPct": 47.3, "plannedPct": 61,
              "lastFlightAt": "…", "openFindings": 8 },
  "recentDocuments": [{ "id", "kind", "title", "pages", "issuedAt", "uploadedAt", "url" }],   // newest 5
  "recentReports": [{ "id", "createdAt", "daysBehind", "url" }],                           // newest 3
  "activeOrder": Order | null,
  "shared": false,              // true when another org shares this project with the caller's org
  "access": "write",            // "write" | "order" | "read" for the caller
  "canOrder": true }            // access is write/order and the caller is not a viewer
```
`contractor`, `lender`, `permitNo`, `buildingType`, `grossAreaM2`, `units`, `coverUrl`, `lastFlightAt` may be `null`.

### Quote
`GET /api/orders/quote?kind=full|revision|targeted&priority=asap|scheduled` →
```json
{ "kind": "full", "priority": "asap", "priceAmd": 225000, "currency": "AMD",
  "includes": ["Car + drone crew on site", "All facades, nadir and 3D model", "Progress vs. schedule", "Independent PDF report"],
  "etaHours": [3, 4], "reportHours": 12 }
```
Placeholder table (`lib/domain/pricing.ts`, shared with the landing and pricing pages): full 180 000, revision 90 000, targeted 120 000 AMD; ASAP +25 %. Missing/invalid params → `400`.

### Orders
`Order`:
```json
{ "id", "number": "INS-2026-0007", "projectId", "projectName", "projectAddress",
  "orgId",                                      // the org that placed the order
  "kind": "full"|"revision"|"targeted", "priority": "asap"|"scheduled",
  "status": "requested"|"confirmed"|"dispatched"|"on_site"|"flying"|"processing"|"delivered"|"cancelled",
  "createdAt", "scheduledFor": null|"…",
  "etaArrivalFrom", "etaArrivalTo",            // arrival window (ASAP: +3h / +4h from confirmation; scheduled: [scheduledFor, +1h])
  "arrivedAt", "flightStartedAt", "flightEndedAt",
  "reportDueAt",                                // flightEndedAt + 12h (estimate before the flight)
  "deliveredAt", "reportId", "reportUrl",
  "crew": null | { "vehicle": "Toyota Hilux · drone unit 1", "plate": "00 AA 001", "pilot": "Drone unit 1", "pilotPhone": "+374 …", "drone": "DJI Matrice 4E" },
  "contactName", "contactPhone", "accessNotes", "focus": ["Floor 13 structure", …],
  "requestedBy": { "id", "name" },
  "events": [{ "at", "status", "message" }],   // oldest first; one per reached status (+ optional "delayed")
  "priceAmd": 225000,                           // quoted at order time, paid by invoice
  "canCancel": true,                            // for the caller, right now
  "timeScale": 1 }                              // DISPATCH_TIME_SCALE frozen at creation
```
Timestamps not yet reached are `null`; `etaArrivalFrom/To` and `reportDueAt` are estimates until reached. `crew` is set at `dispatched`. `reportId`/`reportUrl` are set at `delivered`.

`GET /api/orders?projectId=` → `Order[]` (newest first). Without `projectId`: orders on every project the caller can read. Unknown/unreadable `projectId` → `404`.
`POST /api/orders` body `{ projectId, kind, priority, scheduledFor?, contactName, contactPhone, accessNotes?, focus? }` → `201 Order`
 - `400`: invalid body; `scheduledFor` required when `priority="scheduled"`: an ISO-8601 date-time with `Z` or an offset (a bare date or local time is rejected), ≥ 3 h from now, ≤ 90 days ahead, and starting between 09:00 and 17:00 Asia/Yerevan (UTC+4), both inclusive (daylight flying; `SLOT_FIRST_HOUR`/`SLOT_LAST_HOUR` in `orderTypes.ts`), `issues[].path = "scheduledFor"`; `contactName` and `contactPhone` required (phone: digits, spaces, `+ - ( )`, 6–20 chars); `focus` ≤ 20 items.
 - `403`: viewer, or the project is shared with the caller's org read-only.
 - `404`: project not visible.
 - `409 { error, activeOrderId }`: the project already has an active (not delivered/cancelled) order; enforced by a unique index, so concurrent requests cannot both succeed.
 - `422`: project location outside the Yerevan & Kotayk service area.
`GET /api/orders/:id` → `Order` (`404` if not visible)
`POST /api/orders/:id/cancel` → `200 Order` with `status: "cancelled"` (only while `requested | confirmed | dispatched`, else `409`; `403` per the roles matrix)

Status progresses automatically (dispatch simulator in this MVP; real ops would drive it):
requested → confirmed (+5 min) → dispatched (+15 min) → on_site (at a point in etaArrivalFrom … etaArrivalTo) → flying (+10 min setup) → processing (+45 min flight) → delivered (processing ~6 h, always ≤ `reportDueAt`; a new Flight with `source: "order"` + PDF Report are attached).
The simulator has no new imagery: the order's Flight reuses the photos of the project's latest earlier flight and keeps their capture date (`capturedAt`), so the findings and the report's verdict are as of that date (the PDF says so) and a delivery never changes the project's schedule status on its own.
Each transition is stamped at its due time, so a server that was down catches up with correct times.

Event messages (`events[].message`, also used for notifications), e.g.:
- `requested`: "Order INS-2026-0007 received."
- `confirmed`: "Confirmed. Crew arrives between 14:10 and 15:10."
- `dispatched`: "Drone unit 1 is on the way (00 AA 001)."
- `on_site`: "Crew on site."
- `flying`: "Drone in the air."
- `processing`: "Flight done. Report due by 03:55."
- `delivered`: "Report ready."
- `cancelled`: "Order cancelled."
- `delayed` (not a status; emitted once after 3 failed delivery attempts, the order stays `processing` and keeps retrying): "Report is taking longer than usual. Our team is on it."

Env (see `.env.example`): `DISPATCH_SIMULATOR` (`on` runs the ticker and advance-on-read, `off` disables them; unset = `on` in development and tests but `off` in production (`NODE_ENV=production`), where a demo install must set `on` explicitly and the server then logs a warning at startup), `DISPATCH_TIME_SCALE` (default `1` = real time; demo `240`, i.e. 1 h ≈ 15 s, so a full order finishes in ~5 min; frozen per order as `timeScale`), `DISPATCH_PROCESSING_HOURS` (default `6`).
Live: the project SSE stream (`/api/projects/:id/live`) also emits `event: order` `data: Order` on every status change, only to subscribers who can read the project. `canCancel` in each pushed payload is computed for that subscriber (their role, their access to the project, and whether their org placed the order), exactly as `GET /api/orders/:id` would return it to them, so clients can show or hide Cancel from it without refetching.
