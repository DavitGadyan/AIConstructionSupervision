"use client";

/**
 * Inline "Order an inspection" form (POST /api/orders): what, when (ASAP or a
 * scheduled Yerevan time >= 3 h ahead), focus chips from the open findings,
 * the site contact, and the price quoted from lib/domain/pricing (the same
 * function the API freezes on the order). Handles 400 field issues, 403, 409
 * (track the active order) and 422 (outside the service area).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, cx } from "@/components/ui/primitives";
import { ETA_HOURS, MIN_SCHEDULE_LEAD_HOURS, REPORT_HOURS, SLOT_FIRST_HOUR, SLOT_LAST_HOUR, type ApiErrorDto, type CreateOrderInput, type OrderDto, type OrderKind, type OrderPriority } from "@/lib/domain/orderTypes";
import { scheduleInDaylight } from "@/lib/domain/dispatch";
import { formatAmd, KIND_LABEL, priceAmd, quote } from "@/lib/domain/pricing";
import { fromYerevanInput, toYerevanInput, yHour, yWhen } from "./orderFormat";
import { useNow } from "./useLiveOrder";

const MIN = 60_000;
const HOUR = 60 * MIN;
const PHONE_RE = /^[0-9+\-() ]{6,20}$/;
const MAX_FOCUS = 20;

const KIND_BLURB: Record<OrderKind, (openFindings: number) => string> = {
  full: () => "All facades, nadir and a fresh 3D model",
  revision: (n) => (n ? `Re-check the ${n} open finding${n === 1 ? "" : "s"}` : "Re-check fixes the developer reports"),
  targeted: () => "Chosen floors and issues, close-up evidence",
};

const inputCls =
  "w-full rounded-[12px] bg-page px-3.5 py-3 text-[15px] text-ink outline-none ring-1 ring-line transition placeholder:text-muted focus:bg-surface focus:ring-2 focus:ring-accent aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger";

/**
 * First slot >= 3 h 10 min ahead on the half hour. Starts outside the daylight window the
 * server accepts (SLOT_FIRST_HOUR..SLOT_LAST_HOUR Yerevan) move to 10:00 - the same day
 * before dawn, the next day after the last slot.
 */
function defaultSlot(now: number): string {
  const step = 30 * MIN;
  let t = Math.ceil((now + MIN_SCHEDULE_LEAD_HOURS * HOUR + 10 * MIN) / step) * step;
  if (!scheduleInDaylight(new Date(t))) {
    const h = yHour(t);
    const day = toYerevanInput(h >= SLOT_LAST_HOUR ? t + 24 * HOUR : t).slice(0, 10);
    t = fromYerevanInput(`${day}T10:00`)!.getTime();
  }
  return toYerevanInput(t);
}

export interface OrderFormProps {
  projectId: string;
  projectName: string;
  defaultKind: OrderKind;
  /** Open findings from the latest assessed flight, e.g. "Floor 13 · Structure". */
  findings: string[];
  contact: { name: string; phone: string; notes: string };
  initialNow: number;
}

export function OrderForm({ projectId, projectName, defaultKind, findings, contact, initialNow }: OrderFormProps) {
  const router = useRouter();
  const uid = useId();
  const now = useNow(initialNow, 30_000);
  const [kind, setKind] = useState<OrderKind>(defaultKind);
  const [priority, setPriority] = useState<OrderPriority>("asap");
  const [slot, setSlot] = useState(() => defaultSlot(initialNow));
  const [focus, setFocus] = useState<string[]>(() => (defaultKind === "revision" ? findings.slice(0, MAX_FOCUS) : []));
  const [extra, setExtra] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(contact.phone);
  const [notes, setNotes] = useState(contact.notes);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<ReactNode>(null);
  const [busy, setBusy] = useState(false);
  /** Set while our own POST is in flight, so its SSE echo does not trigger a refresh mid-navigation. */
  const placing = useRef(false);

  const q = useMemo(() => quote(kind, priority), [kind, priority]);
  const chips = useMemo(() => [...findings, ...extra.filter((e) => !findings.includes(e))], [findings, extra]);

  // Someone else (a colleague, the inspector) orders while this form is open: show their order instead.
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource(`/api/projects/${projectId}/live`);
    es.addEventListener("order", (e) => {
      try {
        const o = JSON.parse((e as MessageEvent).data) as OrderDto;
        if (!placing.current && o.projectId === projectId && o.status !== "delivered" && o.status !== "cancelled") router.refresh();
      } catch {}
    });
    return () => es.close();
  }, [projectId, router]);

  function pickKind(k: OrderKind) {
    setKind(k);
    setErrors((e) => ({ ...e, focus: "" }));
    if (k === "revision") setFocus(findings.slice(0, MAX_FOCUS));
    else if (k === "targeted") setFocus([]);
    else setFocus([]);
  }

  function toggle(f: string) {
    setFocus((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : cur.length >= MAX_FOCUS ? cur : [...cur, f]));
  }

  function addDraft() {
    const v = draft.trim().slice(0, 120);
    if (!v) return;
    if (!chips.includes(v)) setExtra((x) => [...x, v]);
    if (!focus.includes(v) && focus.length < MAX_FOCUS) setFocus((cur) => [...cur, v]);
    setDraft("");
  }

  const asapFrom = now + 5 * MIN + ETA_HOURS[0] * HOUR;
  const asapTo = now + 5 * MIN + ETA_HOURS[1] * HOUR;
  const afterDark = yHour(asapTo) >= 20 || yHour(asapFrom) < 7 || yHour(asapFrom) >= 20;
  const slotDate = fromYerevanInput(slot);
  const minSlot = toYerevanInput(now + MIN_SCHEDULE_LEAD_HOURS * HOUR + MIN);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!name.trim()) e.contactName = "Who should the crew call on arrival?";
    const p = phone.trim();
    if (!PHONE_RE.test(p) || (p.match(/\d/g)?.length ?? 0) < 6) e.contactPhone = "Use digits, spaces and + - ( ), 6-20 characters";
    if (priority === "scheduled") {
      if (!slotDate) e.scheduledFor = "Pick a date and time";
      else if (slotDate.getTime() < Date.now() + MIN_SCHEDULE_LEAD_HOURS * HOUR) e.scheduledFor = `Must be at least ${MIN_SCHEDULE_LEAD_HOURS} h from now`;
      // Same daylight rule as the server (lib/domain/dispatch.ts), so the user hears it before submitting.
      else if (!scheduleInDaylight(slotDate)) e.scheduledFor = `We fly in daylight: pick a start between ${String(SLOT_FIRST_HOUR).padStart(2, "0")}:00 and ${SLOT_LAST_HOUR}:00 Yerevan time`;
    }
    if (kind === "targeted" && focus.length === 0) e.focus = "Pick at least one floor or issue to inspect";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`${uid}-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    const body: CreateOrderInput = {
      projectId,
      kind,
      priority,
      scheduledFor: priority === "scheduled" && slotDate ? slotDate.toISOString() : null,
      contactName: name.trim(),
      contactPhone: phone.trim(),
      accessNotes: notes.trim() || undefined,
      focus: kind === "full" ? [] : focus,
    };
    setBusy(true);
    placing.current = true;
    let placed = false;
    try {
      const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as OrderDto & ApiErrorDto;
      if (res.status === 201 || res.ok) {
        // A full navigation, so the project chrome (top bar, rail badge) shows the new order too.
        placed = true;
        window.location.assign(`/app/projects/${projectId}/orders/${data.id}`);
        return;
      }
      if (res.status === 400 && data.issues?.length) {
        const fe: Record<string, string> = {};
        for (const i of data.issues) fe[String(i.path).split(".")[0]] = i.message;
        setErrors(fe);
        setFormError("Please check the highlighted fields.");
      } else if (res.status === 409 && data.activeOrderId) {
        setFormError(
          <>
            {data.error}{" "}
            <Link className="font-medium text-accent underline underline-offset-4" href={`/app/projects/${projectId}/orders/${data.activeOrderId}`}>
              Track it
            </Link>
          </>,
        );
      } else if (res.status === 422) {
        setFormError(
          <>
            {data.error ?? `${projectName} is outside our service area.`}{" "}
            <Link className="font-medium text-accent underline underline-offset-4" href="/contact?topic=inspection">
              Contact us
            </Link>
          </>,
        );
      } else {
        setFormError(data.error ?? "Could not place the order. Please try again.");
      }
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      if (!placed) {
        setBusy(false);
        placing.current = false;
      }
    }
  }

  const err = (k: string) =>
    errors[k] ? (
      <p id={`${uid}-${k}-err`} className="mt-1.5 text-[13px] text-danger">
        {errors[k]}
      </p>
    ) : null;
  const aria = (k: string) => ({ id: `${uid}-${k}`, "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `${uid}-${k}-err` : undefined });

  return (
    <form onSubmit={submit} noValidate className="space-y-3" aria-label="Order an inspection">
      <Step n={1} title="What to inspect">
        <fieldset>
          <legend className="sr-only">Inspection kind</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["full", "revision", "targeted"] as const).map((k) => {
              const on = kind === k;
              return (
                <label
                  key={k}
                  className={cx(
                    "relative flex cursor-pointer flex-col gap-2 rounded-[14px] p-4 ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                    on ? "bg-accent-soft ring-2 ring-accent" : "bg-page ring-line hover:bg-surface",
                  )}
                >
                  <input type="radio" name={`${uid}-kind`} value={k} checked={on} onChange={() => pickKind(k)} className="sr-only" />
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-display text-[17px] font-semibold leading-tight">{KIND_LABEL[k]}</span>
                    <span className={cx("grid size-5 shrink-0 place-items-center rounded-full ring-1", on ? "bg-accent ring-accent" : "bg-surface ring-line")} aria-hidden>
                      {on && <span className="size-2 rounded-full bg-white" />}
                    </span>
                  </span>
                  <span className="text-[13px] leading-snug text-muted">{KIND_BLURB[k](findings.length)}</span>
                  <span className={cx("mt-auto self-start rounded-[var(--radius-pill)] px-2.5 py-1 text-[13px] font-medium tabular", on ? "bg-accent text-white" : "bg-surface text-ink ring-1 ring-line")}>
                    {formatAmd(priceAmd(k, priority))}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </Step>

      <Step n={2} title="When">
        <fieldset>
          <legend className="sr-only">Priority</legend>
          <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-ground p-1">
            {(["asap", "scheduled"] as const).map((p) => (
              <label
                key={p}
                className={cx(
                  "cursor-pointer rounded-[11px] px-3 py-2.5 text-center transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                  priority === p ? "bg-surface text-ink shadow-[var(--shadow-inner)]" : "text-muted hover:text-ink",
                )}
              >
                <input type="radio" name={`${uid}-priority`} value={p} checked={priority === p} onChange={() => setPriority(p)} className="sr-only" />
                <span className="block text-[15px] font-medium">{p === "asap" ? "ASAP" : "Scheduled"}</span>
                <span className="block text-[12px]">{p === "asap" ? `on site in ${ETA_HOURS[0]}-${ETA_HOURS[1]} h` : `pick a slot, ${MIN_SCHEDULE_LEAD_HOURS} h+ ahead`}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {priority === "asap" ? (
          <div className="mt-3 rounded-[12px] bg-page px-4 py-3 text-[14px]">
            <p>
              Car + drone crew on site <b className="tabular">between {yWhen(asapFrom, now)} and {yWhen(asapTo, now)}</b>{" "}
              <span className="text-muted">(Yerevan time, estimated from confirmation)</span>
            </p>
            {afterDark && <p className="mt-1 text-warn">That is after dark. We fly in daylight only, so we will call the site contact to agree the first morning slot.</p>}
          </div>
        ) : (
          <div className="mt-3">
            <label htmlFor={`${uid}-scheduledFor`} className="text-[13px] text-muted">
              Crew arrives from (Yerevan time, 1 h window)
            </label>
            <input
              type="datetime-local"
              {...aria("scheduledFor")}
              value={slot}
              min={minSlot}
              step={900}
              onChange={(e) => setSlot(e.target.value)}
              className={cx(inputCls, "mt-1.5 tabular")}
            />
            {err("scheduledFor") ?? (
              <p className="mt-1.5 text-[13px] text-muted">
                Starts {String(SLOT_FIRST_HOUR).padStart(2, "0")}:00–{SLOT_LAST_HOUR}:00. Earliest {yWhen(now + MIN_SCHEDULE_LEAD_HOURS * HOUR, now)}.{slotDate ? ` Window ${yWhen(slotDate, now)}–${yWhen(slotDate.getTime() + HOUR, slotDate)}.` : ""}
              </p>
            )}
          </div>
        )}
      </Step>

      {kind !== "full" && (
        <Step n={3} title={kind === "revision" ? "Findings to re-check" : "Floors and issues"} hint={`${focus.length}/${MAX_FOCUS} selected`}>
          <div role="group" aria-labelledby={`${uid}-focus-label`} aria-describedby={errors.focus ? `${uid}-focus-err` : undefined}>
            <span id={`${uid}-focus-label`} className="sr-only">
              Focus
            </span>
            {chips.length === 0 && <p className="text-[14px] text-muted">No open findings on the latest flight. Add the floors or issues to look at.</p>}
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => {
                const on = focus.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(c)}
                    className={cx(
                      "rounded-[10px] px-3 py-2 text-[14px] ring-1 transition",
                      on ? "bg-ink text-white ring-ink" : "bg-page text-ink ring-line hover:bg-surface",
                    )}
                  >
                    {on && <span aria-hidden>✓ </span>}
                    {c}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                id={`${uid}-focus`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraft();
                  }
                }}
                placeholder="Add a floor or issue, e.g. Floor 9 balcony slabs"
                aria-label="Add a floor or issue"
                maxLength={120}
                className={inputCls}
              />
              <Button variant="light" onClick={addDraft} disabled={!draft.trim()} className="shrink-0 px-4 ring-1 ring-line">
                Add
              </Button>
            </div>
            {err("focus")}
          </div>
        </Step>
      )}

      <Step n={kind === "full" ? 3 : 4} title="Site contact">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-contactName`} className="text-[13px] text-muted">
              Name
            </label>
            <input {...aria("contactName")} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} className={cx(inputCls, "mt-1.5")} />
            {err("contactName")}
          </div>
          <div>
            <label htmlFor={`${uid}-contactPhone`} className="text-[13px] text-muted">
              Phone
            </label>
            <input {...aria("contactPhone")} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+374 10 000 000" maxLength={20} className={cx(inputCls, "mt-1.5 tabular")} />
            {err("contactPhone")}
          </div>
        </div>
        <label htmlFor={`${uid}-accessNotes`} className="mt-3 block text-[13px] text-muted">
          Access notes <span className="text-muted">(optional)</span>
        </label>
        <textarea {...aria("accessNotes")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Gate, parking, PPE, who meets the crew" className={cx(inputCls, "mt-1.5 resize-y")} />
        {err("accessNotes")}
      </Step>

      <div className="inner flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between md:p-5">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            {KIND_LABEL[kind]} · {priority === "asap" ? "ASAP" : "Scheduled"}
          </p>
          <p className="mt-1 font-display text-[34px] font-bold leading-none tracking-tight tabular" aria-live="polite">
            {formatAmd(q.priceAmd)}
          </p>
          <p className="mt-2 text-[13px] text-muted">VAT excluded · paid by invoice, no payment in the app</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {q.includes.map((i) => (
              <li key={i} className="rounded-[var(--radius-pill)] bg-page px-2.5 py-1 text-[12px] text-ink">
                {i}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 flex-col gap-2 md:items-end">
          <Button type="submit" variant="accent" disabled={busy} className="h-12 w-full px-6 md:w-auto">
            {busy ? "Placing order…" : "Order inspection"}
          </Button>
          <p className="text-[12px] text-muted md:text-right">
            On site in {ETA_HOURS[0]}-{ETA_HOURS[1]} h · PDF within {REPORT_HOURS} h of the flight
          </p>
        </div>
      </div>

      {formError && (
        <div role="alert" className="rounded-[var(--radius-inner)] bg-surface px-4 py-3 text-[14px] text-ink ring-2 ring-danger">
          {formError}
        </div>
      )}
      <p className="px-1 text-[12px] leading-relaxed text-muted">
        Daylight flying only. Wind, rain or restricted airspace can move the slot; if so we call the site contact. Service area: Yerevan & Kotayk.
      </p>
    </form>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="inner p-4 md:p-5">
      <header className="mb-3 flex items-center gap-2.5">
        <span className="grid size-6 place-items-center rounded-full bg-ink text-[12px] font-semibold text-white tabular" aria-hidden>
          {n}
        </span>
        <h3 className="font-display text-[17px] font-semibold">{title}</h3>
        {hint && <span className="ml-auto text-[12px] text-muted tabular">{hint}</span>}
      </header>
      {children}
    </section>
  );
}
