"use client";

import { forwardRef } from "react";
import type { DemoIssue } from "@/lib/content/demoDefects";
import { Button, cx, Pill, severityTone } from "@/components/ui/primitives";
import { KindIcon } from "@/components/three/markers";
import type { Dictionary } from "@/lib/i18n";
import { fmt, localeMeta, localizePath, plural, type Locale } from "@/lib/i18n/config";
import { EvidenceImage } from "./EvidenceImage";
import { SIGN_IN_HREF } from "@/lib/siteMode";

export type ExplorerText = Dictionary["explorer"];

export function whereLabel(i: DemoIssue, t: ExplorerText) {
  const floor = i.floor == null ? t.site : fmt(t.floor, { n: i.floor });
  return i.phase ? `${floor} · ${t.phase[i.phase]}` : floor;
}

export function markerLabel(i: DemoIssue, t: ExplorerText, locale: Locale) {
  const base = fmt(t.markerLabel, { title: i.title, severity: t.severity[i.severity], kind: locale === "en" ? t.kind[i.kind].toLowerCase() : t.kind[i.kind] });
  return i.daysLate ? base + fmt(plural(locale, i.daysLate, t.markerDaysLate), { n: i.daysLate }) : base;
}

/** ORDI TaskTable anatomy: header row + white clickable rows. */
export function IssueList({
  issues,
  flightLabel,
  onSelect,
  t,
  locale,
}: {
  issues: DemoIssue[];
  flightLabel: string;
  onSelect: (id: string) => void;
  t: ExplorerText;
  locale: Locale;
}) {
  return (
    <div>
      <div className="mb-4">
        <h3 className="font-display text-[20px] font-semibold leading-tight md:text-[22px]">{t.listTitle}</h3>
        <p className="mt-1 text-[14px] text-muted">
          {flightLabel} · {fmt(plural(locale, issues.length, t.findings), { n: issues.length })} · {t.pickOne}
        </p>
      </div>
      {issues.length === 0 ? (
        <p className="inner p-4 text-[14px] text-muted">{t.noMatches}</p>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_52px] gap-3 px-3 pb-2 text-[13px] font-medium text-ink/80" aria-hidden>
            <span>{t.colIssue}</span>
            <span>{t.colSeverity}</span>
            <span className="text-right">Δ</span>
          </div>
          <ul className="grid gap-2" aria-label={t.listLabel}>
            {issues.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => onSelect(i.id)}
                  aria-label={markerLabel(i, t, locale)}
                  className="inner grid w-full grid-cols-[minmax(0,1fr)_auto_52px] items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[14px] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-page text-ink/80" aria-hidden>
                      <KindIcon kind={i.kind} className="size-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{i.title}</span>
                      <span className="block truncate text-[12px] text-muted">{whereLabel(i, t)}</span>
                    </span>
                  </span>
                  <Pill tone={severityTone(i.severity)}>{t.severity[i.severity]}</Pill>
                  <span className="tabular text-right font-medium">{i.daysLate ? fmt(t.daysShort, { n: i.daysLate }) : "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export const IssueDetail = forwardRef<
  HTMLHeadingElement,
  { issue: DemoIssue; index: number; total: number; onBack: () => void; onStep: (dir: 1 | -1) => void; t: ExplorerText; locale: Locale }
>(function IssueDetail({ issue: i, index, total, onBack, onStep, t, locale }, headingRef) {
  const delay = i.kind === "delay";
  return (
    <article aria-labelledby={`issue-${i.id}`} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-[14px] font-medium text-ink/80 transition hover:bg-page">
          <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
            <path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t.allIssues}
        </button>
        <div className="flex items-center gap-1.5">
          <span className="tabular mr-1 text-[13px] text-muted">
            {index + 1} / {total}
          </span>
          <StepButton label={t.prevIssue} onClick={() => onStep(-1)} dir={-1} />
          <StepButton label={t.nextIssue} onClick={() => onStep(1)} dir={1} />
        </div>
      </div>

      <div>
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <Pill tone={severityTone(i.severity)}>{t.severity[i.severity]}</Pill>
          <Pill tone="light" className="gap-1.5">
            <KindIcon kind={i.kind} className="size-3.5" />
            {t.kind[i.kind]}
          </Pill>
          <span className="text-[13px] text-muted">{whereLabel(i, t)}</span>
        </div>
        <h3 ref={headingRef} tabIndex={-1} id={`issue-${i.id}`} className="font-display text-[22px] font-bold leading-tight outline-none md:text-[24px]">
          {i.title}
        </h3>
      </div>

      {delay && i.daysLate != null && (
        <div className="flex items-end justify-between gap-4 rounded-[var(--radius-inner)] bg-page p-4">
          <div>
            <p className="font-display text-[44px] font-bold leading-none tracking-tight text-danger tabular">
              {fmt(plural(locale, i.daysLate, t.daysBig), { n: i.daysLate })}
            </p>
            <p className="mt-1.5 text-[13px] text-muted">
              {t.behindBaseline}
              {i.plannedEnd
                ? ` · ${fmt(t.due, { date: new Date(i.plannedEnd).toLocaleDateString(localeMeta[locale].dateLocale, { day: "numeric", month: "short", timeZone: "UTC" }) })}`
                : ""}
            </p>
          </div>
        </div>
      )}

      {i.plannedPct != null && i.observedPct != null && (
        <div className="grid gap-2.5" aria-label={fmt(t.plannedObserved, { planned: i.plannedPct, observed: i.observedPct })} role="group">
          <Bar label={t.planned} value={i.plannedPct} tone="bg-accent2" />
          <Bar label={t.observed} value={i.observedPct} tone="bg-accent" />
        </div>
      )}

      {i.citation && (
        <p className="flex items-start gap-2 text-[13px] text-ink/80">
          <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden>
            <path d="M4 1.8h5.2L12.5 5v9.2H4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M9 2v3.3h3.3M6 8.5h4.5M6 11h4.5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <span>
            <span className="text-muted">{t.source} </span>
            {i.citation}
          </span>
        </p>
      )}

      <p className="text-[15px] leading-relaxed text-ink/85">{i.detail}</p>

      <EvidenceImage
        src={i.image}
        alt={fmt(t.evidenceAlt, { title: locale === "en" ? i.title.toLowerCase() : i.title })}
        labels={{ missing: t.evidenceMissing, caption: t.evidenceCaption }}
      />

      <div className="flex flex-wrap gap-2 pt-1">
        <Button href={SIGN_IN_HREF ?? localizePath("/contact", locale)} variant="accent">
          {t.seeInReport}
        </Button>
        <Button href={localizePath("/resources/how-to-prove-a-developer-is-behind-schedule", locale)} variant="light">
          {t.howWeMeasure}
        </Button>
      </div>
    </article>
  );
});

function Bar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr_44px] items-center gap-3 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-accent2-soft">
        <span className={cx("block h-full rounded-full", tone)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <span className="tabular text-right font-medium">{value}%</span>
    </div>
  );
}

function StepButton({ label, onClick, dir }: { label: string; onClick: () => void; dir: 1 | -1 }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid size-9 place-items-center rounded-[10px] bg-page text-ink transition hover:bg-accent-soft">
      <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
        <path d={dir === -1 ? "M10 3.5L5.5 8l4.5 4.5" : "M6 3.5L10.5 8 6 12.5"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
