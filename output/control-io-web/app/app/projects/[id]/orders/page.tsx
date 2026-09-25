import Link from "next/link";
import { AccentCard, AccentSubCard, Button, GlassCard, Pill } from "@/components/ui/primitives";
import { OrderForm } from "@/components/app/OrderForm";
import { OrderTracker } from "@/components/app/OrderTracker";
import { orderContext } from "@/components/app/orderContext";
import { STATUS_LABEL, statusTone, yDateTime } from "@/components/app/orderFormat";
import { requireSession } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/orders";
import { getCompany } from "@/lib/server/profile";
import { projectSummary } from "@/lib/server/queries";
import { inServiceArea, SERVICE_AREA_NAME } from "@/lib/domain/serviceArea";
import { PHASE_LABEL, type Phase } from "@/lib/domain/schedule";
import { ETA_HOURS, REPORT_HOURS } from "@/lib/domain/orderTypes";
import { formatAmd, FROM_PRICE_AMD, KIND_LABEL } from "@/lib/domain/pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

export default async function OrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const [s, { id }] = await Promise.all([requireSession(), params]);
  const ctx = await orderContext(id, s);
  const { project, canOrder, active } = ctx;
  const [orders, summary, company] = await Promise.all([listOrders(s, id), projectSummary(id), getCompany(s)]);
  const now = Date.now();
  const history = orders.filter((o) => o.id !== active?.id);
  const inArea = inServiceArea(project.lat, project.lng);

  // Prefill the site contact from this org's last order, else the signed-in user + company phone.
  const last = orders.find((o) => o.orgId === s.orgId);
  const contact = last
    ? { name: last.contactName, phone: last.contactPhone, notes: last.accessNotes ?? "" }
    : { name: s.name, phone: company.phone ?? "", notes: "" };
  const findings = summary.findings.map((f) => `Floor ${f.floor} · ${PHASE_LABEL[f.phase as Phase] ?? f.phase}`);

  return (
    <div className="space-y-4">
      <div className="px-2 pt-4">
        <p className="eyebrow">{project.name}</p>
        <h1 className="display-xl mt-3 text-[44px] md:text-[72px]">Orders</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Order an independent drone inspection: a car + drone crew on site in {ETA_HOURS[0]}-{ETA_HOURS[1]} h anywhere in {SERVICE_AREA_NAME}, and a signed PDF report
          within {REPORT_HOURS} h of the flight.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          {active ? (
            <OrderTracker initial={active} initialNow={now} variant="summary" />
          ) : canOrder && inArea ? (
            <div id="new-order" className="scroll-mt-6">
              <GlassCard
                title="Order an inspection"
                subtitle={s.orgRole === "authority" ? "Revision is preselected for building-control inspectors" : "One active order per project; you can cancel until the crew is on site"}
              >
                <OrderForm
                  projectId={project.id}
                  projectName={project.name}
                  defaultKind={s.orgRole === "authority" ? "revision" : "full"}
                  findings={findings}
                  contact={contact}
                  initialNow={now}
                />
              </GlassCard>
            </div>
          ) : canOrder ? (
            <GlassCard title="Outside our service area" subtitle={`We currently fly in ${SERVICE_AREA_NAME}.`}>
              <div className="inner space-y-3 p-4 text-[15px]">
                <p>{project.name} is outside the area our crews cover today. Tell us about the site and we will quote a crew for it.</p>
                <Button href="/contact?topic=inspection" variant="accent">Contact us</Button>
              </div>
            </GlassCard>
          ) : (
            <GlassCard title="Tracking only" subtitle={s.role === "viewer" ? "Viewers can follow inspections but not order them." : "This project is shared with your organisation read-only."}>
              <p className="inner p-4 text-[15px]">
                {s.role === "viewer"
                  ? `Ask an owner or supervisor at ${company.name} to order an inspection. You will see its progress and report here.`
                  : "The project owner, or an organisation it shares ordering with, can order inspections. You will see their progress and reports here."}
              </p>
            </GlassCard>
          )}
        </div>

        <div className="space-y-4">
          <AccentCard title="How it works" subtitle={SERVICE_AREA_NAME}>
            <ol className="space-y-2.5">
              {[
                ["Order", "Pick what to inspect and when. The price is fixed on the order and paid by invoice."],
                [`${ETA_HOURS[0]}-${ETA_HOURS[1]} h`, "Car + drone crew on site (ASAP), or at the slot you booked."],
                [`${REPORT_HOURS} h`, "Independent PDF report after the flight, every shot hashed as evidence."],
              ].map(([k, v]) => (
                <li key={k}>
                  <AccentSubCard className="flex items-center gap-4 py-3">
                    <span className="w-[72px] shrink-0 font-display text-[24px] font-bold leading-none tabular">{k}</span>
                    <span className="text-[13px] leading-snug text-white/90">{v}</span>
                  </AccentSubCard>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Pill tone="light" className="text-ink">From {formatAmd(FROM_PRICE_AMD)}</Pill>
              <Pill tone="dark">VAT excl.</Pill>
            </div>
          </AccentCard>

          <GlassCard title="History" subtitle={`${history.length} inspection${history.length === 1 ? "" : "s"} on this project`}>
            <ul className="space-y-2">
              {history.length === 0 && <li className="inner p-4 text-[14px] text-muted">No inspections yet.</li>}
              {history.map((o) => (
                <li key={o.id} className="inner p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-[17px] font-semibold tabular">{o.number}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {KIND_LABEL[o.kind]} · {o.priority === "asap" ? "ASAP" : "Scheduled"} · <span className="whitespace-nowrap tabular">{formatAmd(o.priceAmd)}</span>
                      </p>
                      <p className="text-[13px] text-muted">
                        {yDateTime(o.createdAt)} · {o.requestedBy.name}
                      </p>
                    </div>
                    <Pill tone={statusTone(o.status)}>{STATUS_LABEL[o.status]}</Pill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {o.reportUrl && (
                      <a href={o.reportUrl} target="_blank" rel="noreferrer" className="rounded-[12px] bg-ink px-4 py-2 text-[14px] text-white hover:bg-black">
                        Open PDF
                      </a>
                    )}
                    <Link href={`/app/projects/${id}/orders/${o.id}`} className="rounded-[12px] bg-surface px-4 py-2 text-[14px] ring-1 ring-line hover:bg-page" aria-label={`Details of ${o.number}`}>
                      Details
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
