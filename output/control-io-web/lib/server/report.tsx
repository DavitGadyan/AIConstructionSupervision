/**
 * Evidence-grade delay report.
 *
 * Part 1 (react-pdf): verdict, plan-vs-actual, findings with the schedule page
 * each planned date was read from, every drone shot and 3D capture with its
 * timestamp, GPS and SHA-256, method and chain of custody.
 * Part 2 (pdf-lib): the official documents themselves, appended as annexes and
 * stamped "Annex X - page n", so the report is self-contained.
 */
import React from "react";
import type * as ReactPdf from "@react-pdf/renderer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "./db";
import { get, put, sha256 } from "./storage";
import { projectSummary, listFlights } from "./queries";
import { PHASE_LABEL, type Phase } from "../domain/schedule";
import { tokens } from "../tokens";

const C = tokens.color;
// Plain style object (StyleSheet.create is an identity helper in react-pdf).
const s = {
  page: { padding: 40, paddingBottom: 56, fontFamily: "Helvetica", fontSize: 9.5, color: C.ink, backgroundColor: "#FFFFFF" },
  band: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: C.accent },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 18, marginBottom: 4 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 13, marginBottom: 8, marginTop: 4 },
  muted: { color: C.muted },
  eyebrow: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 1 },
  card: { backgroundColor: C.ground, borderRadius: 10, padding: 12, marginBottom: 10 },
  row: { flexDirection: "row" },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: C.muted, paddingVertical: 4 },
  td: { fontSize: 8.5, paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: "#E1E5E7" },
  pill: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7.5, color: "#FFFFFF" },
  mono: { fontFamily: "Courier", fontSize: 7 },
} satisfies Record<string, ReactPdf.Styles[string]>;

const fmtD = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
const fmtDT = (d: Date | string) => new Date(d).toISOString().replace("T", " ").slice(0, 16) + " UTC";
const sevColor = (sev: string) => (sev === "critical" ? C.danger : sev === "late" ? C.accent : sev === "watch" ? C.accent2 : C.ok);

/** Provenance printed on the cover when the report was commissioned as an on-demand inspection. */
export interface ReportOrderProvenance {
  number: string; // INS-2026-0007
  kind: string; // full | revision | targeted
  priority: string; // asap | scheduled
  orderedBy: string; // person
  orgName: string; // ordering organisation
  orderedAt: Date;
  crew?: { pilot: string; plate: string; drone: string; vehicle: string } | null;
  flightStartedAt?: Date | null;
  /** Demo dispatch simulator: the flight reuses the imagery of an earlier flight (disclosed on every evidence page). */
  reusedImageryFrom?: Date | null;
}

const KIND_TEXT: Record<string, string> = { full: "Full inspection", revision: "Revision (re-inspection of open findings)", targeted: "Targeted inspection" };

export async function buildReport(opts: { projectId: string; flightId?: string; userId?: string | null; order?: ReportOrderProvenance | null; generatedAt?: Date }) {
  // react-pdf is ESM-only; a dynamic import keeps this module loadable from CJS (tsx scripts) and Next.
  const { Document, Image, Page, Text, View, renderToBuffer } = await import("@react-pdf/renderer");
  function Footer({ reportId, project }: { reportId: string; project: string }) {
    return (
      <View style={s.footer} fixed>
        <Text>control.io | {project} | Report {reportId}</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages} (excluding annexes)`} />
      </View>
    );
  }

  const summary = await projectSummary(opts.projectId, opts.flightId);
  if (!summary.latestFlight || !summary.variance) throw new Error("No assessed flight to report on");
  const { project, variance, findings, floors } = summary;
  const flight = await db.flight.findUniqueOrThrow({ where: { id: summary.latestFlight.id }, include: { shots: { orderBy: { createdAt: "asc" } }, reconstruction: true } });
  const documents = await db.document.findMany({ where: { projectId: project.id }, orderBy: { uploadedAt: "asc" } });
  // Oldest first, one row per capture: a demo order's flight reuses an earlier flight's imagery, capture time and values.
  const history = (await listFlights(project.id))
    .filter((f) => f.daysBehind != null)
    .reverse()
    .filter((f, i, all) => all.findIndex((x) => new Date(x.capturedAt).getTime() === new Date(f.capturedAt).getTime()) === i);
  const milestones = await db.milestone.findMany({ where: { id: { in: findings.map((f) => f.milestoneId).filter((x): x is string => !!x) } }, include: { document: true } });
  const reportId = `CIO-${fmtD(opts.generatedAt ?? new Date()).replace(/-/g, "")}-${flight.id.slice(-6).toUpperCase()}`;
  const generatedAt = opts.generatedAt ?? new Date();
  const order = opts.order ?? null;
  // Demo simulator: the order's flight reuses earlier imagery and is dated when it was captured, so the verdict is as of that date.
  const reused = !!order?.reusedImageryFrom;
  const user = opts.userId ? await db.user.findUnique({ where: { id: opts.userId } }) : null;

  const shots = await Promise.all(
    flight.shots.map(async (sh) => ({ ...sh, data: await get(sh.fileKey) })),
  );
  const photos = shots.filter((x) => x.view !== "model-capture");
  const captures = shots.filter((x) => x.view === "model-capture");
  const hero = photos.find((x) => x.view === "orbit") ?? photos[0];
  const shotIndex = new Map(shots.map((x, i) => [x.id, `E${String(i + 1).padStart(2, "0")}`]));
  const annexLetter = new Map(documents.map((d, i) => [d.id, String.fromCharCode(65 + i)]));

  const behind = variance.daysBehind;
  const verdict = behind > 2 ? `${behind} DAYS BEHIND PLAN` : behind < -2 ? `${-behind} DAYS AHEAD OF PLAN` : "ON PLAN";
  const projected = new Date(project.plannedCompletion.getTime() + Math.max(0, behind) * 86_400_000);
  const critical = findings.filter((f) => f.severity === "critical" || f.severity === "late");

  const doc = (
    <Document
      title={`${project.name} - Construction progress report ${fmtD(flight.capturedAt)}${order ? ` (${order.number})` : ""}`}
      author="control.io"
      subject={order ? `Independent inspection report for order ${order.number}` : "Independent construction progress and schedule-variance report"}
    >
      {/* Cover */}
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed />
        <Text style={[s.eyebrow, { marginTop: 10 }]}>Independent construction progress report</Text>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 26, marginTop: 6 }}>{project.name}</Text>
        <Text style={[s.muted, { marginTop: 4 }]}>{project.address} | Developer: {project.developer} | Permit {project.permitNo ?? "-"}</Text>
        {hero && <Image src={{ data: hero.data, format: "jpg" }} style={{ width: "100%", height: order ? 250 : 300, objectFit: "cover", borderRadius: 12, marginTop: 18 }} />}
        <View style={[s.card, { marginTop: 16, backgroundColor: behind > 2 ? C.accent : C.ground, padding: 18 }]}>
          <Text style={{ fontSize: 9, color: behind > 2 ? "#FFFFFF" : C.muted }}>
            {reused ? `Verdict as of the reused imagery, captured ${fmtDT(flight.capturedAt)}` : `Verdict at flight of ${fmtDT(flight.capturedAt)}`}
          </Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 30, marginTop: 4, color: behind > 2 ? "#FFFFFF" : C.ink }}>{verdict}</Text>
          <Text style={{ fontSize: 9.5, marginTop: 6, color: behind > 2 ? "#FFFFFF" : C.ink }}>
            Earned {variance.earnedPct}% of the observable works against {variance.plannedPct}% planned. The site stands where the approved schedule placed it on {fmtD(variance.earnedScheduleDate)}.
          </Text>
        </View>
        <View style={[s.row, { gap: 10 }]}>
          {[
            ["Report ID", reportId],
            ["Generated", fmtDT(generatedAt)],
            ["Prepared for", user?.name ?? "Project stakeholders"],
            ["Evidence items", String(shots.length)],
          ].map(([k, v]) => (
            <View key={k} style={[s.card, { flex: 1 }]}>
              <Text style={s.eyebrow}>{k}</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 3 }}>{v}</Text>
            </View>
          ))}
        </View>
        {order && (
          <View style={[s.card, { borderLeftWidth: 3, borderLeftColor: C.accent }]} wrap={false}>
            <Text style={s.eyebrow}>On-demand inspection {order.number}</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 3 }}>
              {KIND_TEXT[order.kind] ?? order.kind} | {order.priority === "asap" ? "ASAP" : "Scheduled"} | ordered {fmtDT(order.orderedAt)} by {order.orderedBy}, {order.orgName}
            </Text>
            <Text style={[s.muted, { marginTop: 3 }]}>
              {order.crew ? `Flown by ${order.crew.pilot} (${order.crew.drone}, ${order.crew.vehicle}, ${order.crew.plate})` : "Flown by a control.io field crew"}
              {order.flightStartedAt ? ` on ${fmtDT(order.flightStartedAt)}` : ""}. control.io is independent of the developer and the contractor.
            </Text>
            {order.reusedImageryFrom && (
              <Text style={[s.muted, { marginTop: 3 }]}>
                Demo: this order was fulfilled by the dispatch simulator; the imagery is reused from the flight of {fmtD(order.reusedImageryFrom)}, so the verdict and every finding are as of that date.
              </Text>
            )}
          </View>
        )}
        <Footer reportId={reportId} project={project.name} />
      </Page>

      {/* Executive summary + plan vs actual */}
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed />
        <Text style={s.h1}>1. Executive summary</Text>
        <Text style={{ lineHeight: 1.5, marginBottom: 10 }}>
          {reused
            ? `Order ${order!.number} was fulfilled by the demo dispatch simulator, which reused the ${photos.length} geo-tagged photographs control.io captured of ${project.name} on ${fmtD(flight.capturedAt)}`
            : `On ${fmtD(flight.capturedAt)} control.io flew ${project.name} and captured ${photos.length} geo-tagged photographs`}
          {flight.reconstruction?.floorsDetected != null ? ` and a 3D reconstruction showing ${flight.reconstruction.floorsDetected} completed structural storeys` : ""}.
          Comparing the observed state of every storey with the approved baseline schedule ({documents.find((d) => d.kind === "schedule")?.title ?? "baseline schedule"}), the works {reused ? `were, on ${fmtD(flight.capturedAt)},` : "are"}{" "}
          {behind > 2 ? `${behind} calendar days behind plan` : behind < -2 ? `${-behind} days ahead of plan` : "on plan"} (schedule performance index {variance.spi}).
          {critical.length > 0 && ` ${critical.length} milestone${critical.length > 1 ? "s are" : " is"} late or critical; the most delayed is floor ${critical[0].floor} ${PHASE_LABEL[critical[0].phase as Phase].toLowerCase()} at ${critical[0].daysBehind} days.`}
          {behind > 2 && ` At the current rate, contractual completion of ${fmtD(project.plannedCompletion)} moves to approximately ${fmtD(projected)} unless the delay is recovered.`}
        </Text>
        <View style={[s.row, { gap: 10, marginBottom: 12 }]}>
          {[
            ["Days behind", String(behind)],
            ["Planned value", `${variance.plannedPct}%`],
            ["Earned value", `${variance.earnedPct}%`],
            ["SPI(t)", String(variance.spi)],
          ].map(([k, v]) => (
            <View key={k} style={[s.card, { flex: 1 }]}>
              <Text style={s.eyebrow}>{k}</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 18, marginTop: 3 }}>{v}</Text>
            </View>
          ))}
        </View>
        <Text style={s.h2}>Progress by phase</Text>
        {variance.byPhase.filter((p) => p.phase !== "finishes").map((p) => (
          <View key={p.phase} style={{ marginBottom: 7 }}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text>{PHASE_LABEL[p.phase]}</Text>
              <Text style={s.muted}>observed {p.earnedPct}% / planned {p.plannedPct}%</Text>
            </View>
            <View style={{ height: 7, backgroundColor: C.ground, borderRadius: 4, marginTop: 3 }}>
              <View style={{ position: "absolute", height: 7, width: `${p.plannedPct}%`, backgroundColor: C.accent2Soft, borderRadius: 4 }} />
              <View style={{ position: "absolute", height: 7, width: `${p.earnedPct}%`, backgroundColor: C.accent, borderRadius: 4 }} />
            </View>
          </View>
        ))}

        <Text style={[s.h2, { marginTop: 12 }]}>2. Plan vs actual by storey</Text>
        <View style={s.row}>
          {["Storey", "Structure obs / plan", "Envelope obs / plan", "Glazing obs / plan", "Worst delay", "Status"].map((h, i) => (
            <Text key={h} style={[s.th, { width: i === 0 ? "10%" : "18%" }]}>{h}</Text>
          ))}
        </View>
        {[...floors].reverse().map((f) => (
          <View key={f.floor} style={s.row} wrap={false}>
            <Text style={[s.td, { width: "10%" }]}>L{String(f.floor).padStart(2, "0")}</Text>
            <Text style={[s.td, { width: "18%" }]}>{f.structure ?? "-"}% / {f.plannedStructure ?? "-"}%</Text>
            <Text style={[s.td, { width: "18%" }]}>{f.envelope ?? "-"}% / {f.plannedEnvelope ?? "-"}%</Text>
            <Text style={[s.td, { width: "18%" }]}>{f.glazing ?? "-"}% / {f.plannedGlazing ?? "-"}%</Text>
            <Text style={[s.td, { width: "18%" }]}>{f.daysBehind != null && f.daysBehind > 0 ? `${f.daysBehind} d` : "-"}</Text>
            <View style={[s.td, { width: "18%" }]}>
              <Text style={[s.pill, { backgroundColor: sevColor(f.status), alignSelf: "flex-start" }]}>{f.status}</Text>
            </View>
          </View>
        ))}
        <Footer reportId={reportId} project={project.name} />
      </Page>

      {/* Findings with document citations */}
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed />
        <Text style={s.h1}>3. Late milestones and their contractual source</Text>
        <Text style={[s.muted, { marginBottom: 10 }]}>Each planned date below is quoted from the official document annexed to this report. Evidence references point to section 4.</Text>
        {findings.length === 0 && <Text>No milestone is more than two days behind plan.</Text>}
        {findings.map((f) => {
          const m = milestones.find((x) => x.id === f.milestoneId);
          return (
            <View key={f.id} style={[s.card, { flexDirection: "row", gap: 10 }]} wrap={false}>
              <View style={{ width: 70 }}>
                <Text style={[s.pill, { backgroundColor: sevColor(f.severity), alignSelf: "flex-start" }]}>{f.severity}</Text>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 16, marginTop: 4 }}>-{f.daysBehind}d</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Floor {f.floor} - {PHASE_LABEL[f.phase as Phase]}</Text>
                <Text style={{ marginTop: 2 }}>Planned complete by {fmtD(f.plannedEnd)} ({f.plannedPct}% expected at the flight date). Observed {f.observedPct}%.</Text>
                {m?.document && (
                  <Text style={[s.muted, { marginTop: 3 }]}>
                    Source: Annex {annexLetter.get(m.document.id)} - {m.document.title}, page {m.sourcePage}: "{m.sourceQuote}"
                  </Text>
                )}
                <Text style={[s.muted, { marginTop: 3 }]}>Evidence: {f.evidence.map((id) => shotIndex.get(id)).filter(Boolean).join(", ") || "see section 4"}</Text>
              </View>
            </View>
          );
        })}
        {history.length > 1 && (
          <>
            <Text style={[s.h2, { marginTop: 10 }]}>Trend across flights</Text>
            <View style={s.row}>
              {["Flight date", "Planned value", "Earned value", "Days behind"].map((h) => (
                <Text key={h} style={[s.th, { width: "25%" }]}>{h}</Text>
              ))}
            </View>
            {history.map((h) => (
              <View key={h.id} style={s.row}>
                <Text style={[s.td, { width: "25%" }]}>{fmtD(h.capturedAt)}</Text>
                <Text style={[s.td, { width: "25%" }]}>{h.plannedPct}%</Text>
                <Text style={[s.td, { width: "25%" }]}>{h.earnedPct}%</Text>
                <Text style={[s.td, { width: "25%" }]}>{h.daysBehind}</Text>
              </View>
            ))}
          </>
        )}
        <Footer reportId={reportId} project={project.name} />
      </Page>

      {/* Evidence */}
      {[...photos, ...captures].map((sh) => (
        <Page key={sh.id} size="A4" style={s.page}>
          <View style={s.band} fixed />
          <Text style={s.eyebrow}>4. Evidence {shotIndex.get(sh.id)}</Text>
          <Text style={s.h1}>{sh.label ?? sh.view}</Text>
          <Image src={{ data: sh.data, format: sh.fileKey.endsWith(".png") ? "png" : "jpg" }} style={{ width: "100%", height: 330, objectFit: "contain", backgroundColor: C.ground, borderRadius: 10, marginTop: 8 }} />
          <View style={[s.card, { marginTop: 12 }]}>
            {[
              ["Captured", fmtDT(sh.capturedAt)],
              ["Type", sh.view === "model-capture" ? "Screenshot of 3D reconstruction" : `Drone photograph (${sh.view})`],
              ["Position", sh.lat != null ? `${sh.lat.toFixed(6)}, ${sh.lng?.toFixed(6)}${sh.altM != null ? ` | altitude ${sh.altM} m AGL` : ""}` : "not recorded"],
              [
                "Flight",
                reused && order?.flightStartedAt
                  ? `${order.number}, simulated ${fmtD(order.flightStartedAt)} | pilot ${flight.pilot ?? "-"} | ${flight.drone ?? "-"} | imagery captured ${fmtD(flight.capturedAt)}`
                  : `${fmtD(flight.capturedAt)} | pilot ${flight.pilot ?? "-"} | ${flight.drone ?? "-"}`,
              ],
              [
                "Source",
                flight.source === "sample"
                  ? "Sample flight: synthetic 3D render photorealised with AI (gpt-image-2), not a real photograph"
                  : flight.source === "order" && order?.reusedImageryFrom
                    ? `On-demand inspection ${order.number} (demo dispatch simulator): image reused from the sample flight of ${fmtD(order.reusedImageryFrom)}, a synthetic 3D render photorealised with AI, not a new photograph`
                    : flight.source === "order"
                      ? `On-demand inspection${order ? ` ${order.number}` : ""}`
                      : flight.source,
              ],
            ].map(([k, v]) => (
              <View key={k} style={[s.row, { marginBottom: 4 }]}>
                <Text style={{ width: 80, color: C.muted }}>{k}</Text>
                <Text style={{ flex: 1 }}>{v}</Text>
              </View>
            ))}
            <View style={s.row}>
              <Text style={{ width: 80, color: C.muted }}>SHA-256</Text>
              <Text style={[s.mono, { flex: 1 }]}>{sh.sha256}</Text>
            </View>
          </View>
          <Footer reportId={reportId} project={project.name} />
        </Page>
      ))}

      {/* Method + chain of custody + annex index */}
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed />
        <Text style={s.h1}>5. Method and chain of custody</Text>
        <Text style={{ lineHeight: 1.5 }}>
          Observation. Each storey is assessed for structure (columns, core, slab), envelope (external walls and panels) and glazing from the drone photographs, cross-checked against the slab height of the 3D reconstruction. Interior finishes are not observable from the air and are excluded.
        </Text>
        <Text style={{ lineHeight: 1.5, marginTop: 6 }}>
          Plan. Planned start and finish dates are read from the official schedule; each is stored with the page and row it came from.
        </Text>
        <Text style={{ lineHeight: 1.5, marginTop: 6 }}>
          Variance. Earned Schedule (Lipke, 2003): every milestone carries planned value in proportion to its duration. The earned-schedule date ES is the date on which the plan expected the value actually observed; days behind = flight date - ES. Per-milestone delay = flight date - the date the plan expected the observed percentage.
        </Text>
        <Text style={{ lineHeight: 1.5, marginTop: 6 }}>
          Integrity. Every photograph, capture and document is hashed (SHA-256) when it is received and the hash is printed here. Any later alteration of a file changes its hash.
        </Text>
        <Text style={[s.h2, { marginTop: 14 }]}>Annexed official documents</Text>
        {documents.map((d) => (
          <View key={d.id} style={[s.card]} wrap={false}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Annex {annexLetter.get(d.id)} - {d.title}</Text>
            <Text style={s.muted}>
              {d.kind} | {d.pages} page{d.pages === 1 ? "" : "s"} | issued {d.issuedAt ? fmtD(d.issuedAt) : "-"} by {d.issuer ?? "-"} | received {fmtD(d.uploadedAt)}
            </Text>
            <Text style={[s.mono, { marginTop: 3 }]}>SHA-256 {d.sha256}</Text>
          </View>
        ))}
        <Footer reportId={reportId} project={project.name} />
      </Page>
    </Document>
  );

  const main = await renderToBuffer(doc);

  // Append annexes
  const out = await PDFDocument.load(main);
  const font = await out.embedFont(StandardFonts.HelveticaBold);
  const mainPages = out.getPageCount();
  for (const d of documents) {
    if (!d.fileKey.endsWith(".pdf")) continue;
    const src = await PDFDocument.load(await get(d.fileKey), { ignoreEncryption: true });
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p, i) => {
      out.addPage(p);
      const { width, height } = p.getSize();
      p.drawRectangle({ x: width - 190, y: height - 22, width: 180, height: 16, color: rgb(0.04, 0.56, 0.64) });
      p.drawText(`ANNEX ${annexLetter.get(d.id)} - page ${i + 1}/${src.getPageCount()}`, { x: width - 184, y: height - 17.5, size: 8, font, color: rgb(1, 1, 1) });
    });
  }
  out.setTitle(`${project.name} - progress report ${fmtD(flight.capturedAt)} (${reportId})`);
  out.setProducer("control.io");
  const bytes = Buffer.from(await out.save());
  const stored = await put(`projects/${project.id}/reports`, `${reportId}.pdf`, bytes);
  const report = await db.report.create({
    data: {
      projectId: project.id,
      flightId: flight.id,
      createdById: opts.userId ?? null,
      ...(opts.generatedAt ? { createdAt: opts.generatedAt } : {}),
      fileKey: stored.key,
      sha256: sha256(bytes),
      pages: out.getPageCount(),
      daysBehind: behind,
    },
  });
  return { report, mainPages, reportId };
}
