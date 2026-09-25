# control.io — AI construction supervision

Independent drone supervision for multistorey construction. Drone flights become geo-tagged shots and a 3D reconstruction. These are compared with the developer's official schedule, permit and contract. The platform shows how many days the project is behind plan, per storey and per phase, and issues an evidence-grade PDF report. The service line also covers thermal inspection of solar panels.

**On-demand inspections (v1.1):** owners and building inspectors order an inspection or a revision from the phone. In Yerevan and Kotayk a car with a drone crew is on site within 3–4 hours of confirmation, and the independent PDF report follows within 12 hours of the flight.

| Folder | What |
|---|---|
| `output/control-io-web` | Next.js 15 app: marketing site in EN/HY/RU (SEO/GEO, typed headlines, 3D defect explorer), web dashboard, REST API, dispatch simulator, PDF reports |
| `output/control-io-mobile` | Expo (React Native) app: Home, Project (facts, map, documents), Order wizard with live tracking, Activity, Company profile |

UI template: **ORDI** from the design library, re-skinned to control.io's lagoon blue `#0A8FA3` and metal grey `#6B737A`, with Space Grotesk and Inter fonts (Noto Sans Armenian for Armenian).

## Quick start (web)

```bash
cd output/control-io-web
npm install
cp .env.example .env            # set AUTH_SECRET; ANTHROPIC_API_KEY enables AI document reading + photo assessment
npm run setup                   # prisma db push + sample PDFs + seed
DISPATCH_TIME_SCALE=240 npm run dev   # demo speed: an ASAP order is delivered in about 3 minutes
```

Open http://localhost:3000. The site is in English at `/`, Armenian at `/hy` and Russian at `/ru`. Sign in at `/login`.

| Demo login (password `demo1234`) | Role |
|---|---|
| `demo@control.io` | Owner at the lender "Lender bank"; can order, cancel and edit the company |
| `viewer@control.io` | Viewer: can track orders but not place them |
| `inspector@control.io` | Inspector at "Building control authority", a project shared with it; defaults to Revision |
| `outside@control.io` | Owns a project in Gyumri, outside the service area (orders get 422) |

**Commands:**
- `npm test` runs 94 tests: Earned Schedule, the dispatch state machine, pricing, service area, the typing tokenizer, and GLB measurement.
- `npm run typecheck` runs the TypeScript checker.
- `npm run samples:render` rebuilds the photoreal sample meshes and drone plates. It needs Blender 4.x.

**Settings (`.env`, see `.env.example`):**
- `AUTH_SECRET`: required. Production refuses to start without a strong value (32 characters or more).
- `DISPATCH_SIMULATOR`: on in development. Production must set it to `on` explicitly.
- `DISPATCH_TIME_SCALE`: 1 is real time; 240 makes 1 hour take about 15 seconds.
- `CORS_ORIGINS`: extra browser origins, such as a hosted Expo web build. Native apps need none.
- `NODEODM_URL`: set it to run real photogrammetry.
- `OPENAI_API_KEY` and `HF_API_KEY_ID`/`HF_API_KEY_SECRET`: only used by `scripts/imagery/*` to regenerate photoreal imagery.

## Quick start (mobile)

```bash
cd output/control-io-mobile
npm install
EXPO_PUBLIC_API_URL=http://<your-LAN-ip>:3000 npx expo start
# release/web builds: add --clear so a cached EXPO_PUBLIC_API_URL is not reused
```

## How it works

1. **Fly.** Drone photos are uploaded from the web, from the mobile app on site, or by an on-demand inspection crew. EXIF GPS, altitude and time are kept, and every file is SHA-256 hashed.
2. **Reconstruct.** With `NODEODM_URL` set, the photos go to NodeODM/OpenDroneMap, which returns a textured GLB. The sample flights ship with a photoreal Blender-built mesh. The number of completed storeys is measured from the mesh slab height.
3. **Read the plan.** Claude reads the uploaded schedule, permit and contract PDFs into dated milestones. Each milestone keeps the page and quote it came from.
4. **Assess.** Claude vision rates each storey's structure, envelope and glazing from the photos, cross-checked against the mesh.
5. **Compare.** Earned Schedule gives the project's days behind, plus the delay on each milestone.
6. **Report.** The PDF contains:
   - the verdict and plan vs actual
   - late milestones with document citations
   - every photo and 3D capture with its hash
   - the method
   - the official documents, annexed

**Ordering an inspection:**
- **Lifecycle:** requested → confirmed → dispatched → on site → flying → processing → delivered, or cancelled until the crew is on site.
- **Price:** shown before confirming, paid by invoice. Current amounts are placeholders: full 180 000, revision 90 000 and targeted 120 000 AMD, with a 25 % surcharge for ASAP.
- **Slots:** daylight only, starting between 09:00 and 17:00 Yerevan time.
- **Tracking:** live, over server-sent events on the web and in the app.

Sample data and sample imagery are synthetic, AI-photorealised, and marked as such, including in the PDF.
