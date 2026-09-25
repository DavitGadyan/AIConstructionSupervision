import { GlassCard, Pill } from "@/components/ui/primitives";
import { UploadDocument } from "@/components/app/UploadDocument";
import { aiEnabled } from "@/lib/server/ai";
import { db } from "@/lib/server/db";
import { listDocuments } from "@/lib/server/queries";
import { PHASE_LABEL, type Phase } from "@/lib/domain/schedule";
import { orderContext } from "@/components/app/orderContext";
import { requireSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

const d = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : "—");

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const [s, { id }] = await Promise.all([requireSession(), params]);
  const [{ access }, docs, milestones] = await Promise.all([
    orderContext(id, s),
    listDocuments(id),
    db.milestone.findMany({ where: { projectId: id }, orderBy: [{ floor: "asc" }, { plannedStart: "asc" }], include: { document: { select: { title: true } } } }),
  ]);
  return (
    <div className="space-y-4">
      <div className="px-2 pt-4">
        <h1 className="display-xl text-[44px] md:text-[72px]">Documents</h1>
        <p className="mt-3 max-w-2xl text-muted">The official schedule, permit and contract the developer is measured against. Every file is hashed on receipt and annexed to each report.</p>
      </div>
      {access === "write" && (
        <GlassCard title="Upload a document" subtitle="Schedules are read by Claude into dated milestones, each with the page it came from.">
          <UploadDocument projectId={id} aiEnabled={aiEnabled()} />
        </GlassCard>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {docs.map((doc) => (
          <GlassCard key={doc.id} as="article" title={doc.title} subtitle={`${doc.kind} · ${doc.pages} page${doc.pages === 1 ? "" : "s"}`} href={doc.url}>
            <div className="inner space-y-1.5 text-[13px]">
              <p><span className="text-muted">Issuer</span> {doc.issuer ?? "—"}</p>
              <p><span className="text-muted">Issued</span> {d(doc.issuedAt)} · <span className="text-muted">received</span> {d(doc.uploadedAt)}</p>
              <p className="truncate font-mono text-[11px] text-muted" title={doc.sha256}>sha256 {doc.sha256}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Pill tone={doc.status === "extracted" ? "accent" : doc.status === "failed" ? "danger" : "grey"}>{doc.status}</Pill>
                {doc.milestoneCount > 0 && <Pill tone="light">{doc.milestoneCount} milestones</Pill>}
              </div>
              {doc.error && <p className="text-muted">{doc.error}</p>}
            </div>
          </GlassCard>
        ))}
      </div>
      <GlassCard title="Baseline milestones" subtitle={`${milestones.length} dated milestones, with their source`}>
        <div className="max-h-[520px] overflow-auto rounded-[var(--radius-inner)]">
          <table className="w-full min-w-[720px] border-separate border-spacing-y-1.5 text-left text-[14px]">
            <thead className="sticky top-0 bg-ground/95 text-[13px] text-muted backdrop-blur">
              <tr><th className="px-3 py-2 font-normal">Storey</th><th className="px-3 font-normal">Phase</th><th className="px-3 font-normal">Start</th><th className="px-3 font-normal">Finish</th><th className="px-3 font-normal">Source</th></tr>
            </thead>
            <tbody>
              {milestones.map((m) => (
                <tr key={m.id} className="bg-surface">
                  <td className="rounded-l-[12px] px-3 py-2.5">L{String(m.floor ?? 0).padStart(2, "0")}</td>
                  <td className="px-3">{PHASE_LABEL[m.phase as Phase]}</td>
                  <td className="px-3 tabular">{d(m.plannedStart)}</td>
                  <td className="px-3 tabular">{d(m.plannedEnd)}</td>
                  <td className="rounded-r-[12px] px-3 text-[13px] text-muted">{m.document?.title ?? "manual"}{m.sourcePage ? `, p. ${m.sourcePage}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
