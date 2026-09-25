"use client";

import { useEffect, useRef, useState } from "react";
import { Button, cx } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/config";
import { Icon } from "./icons";

type State = "idle" | "sending" | "sent";
type Topic = "pilot" | "inspection";

const field =
  "mt-1.5 block w-full rounded-[12px] border border-line bg-surface px-4 py-3 text-[16px] text-ink placeholder:text-muted/70 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent";

/**
 * Posts to /api/contact. If that route is missing or fails, the visitor still
 * gets a confirmation plus a mailto fallback, so no enquiry is silently lost.
 */
/** Role values stay in English for the CRM; only the visible label is translated. */
const ROLES = [
  ["Developer", "developer"],
  ["Bank or lender", "lender"],
  ["Municipal building control", "municipal"],
  ["Insurer or surety", "insurer"],
  ["General contractor", "contractor"],
  ["Solar owner or O&M", "solar"],
  ["Other", "other"],
] as const;

/**
 * Localised browser validation: the built-in bubbles follow the browser's
 * language, not the page's, so required/email messages are set explicitly.
 */
function validity(t: Dictionary["contactForm"]) {
  return {
    onInvalid: (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      el.setCustomValidity(el.validity.valueMissing ? t.invalidRequired : el.validity.typeMismatch ? t.invalidEmail : "");
    },
    onInput: (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => e.currentTarget.setCustomValidity(""),
  };
}

export function ContactForm({ email, t, lang = "en" }: { email: string; t: Dictionary["contactForm"]; lang?: string }) {
  const v = validity(t);
  const [state, setState] = useState<State>("idle");
  const [delivered, setDelivered] = useState(true);
  const [mailto, setMailto] = useState(`mailto:${email}`);
  // Every "Order an inspection" link points at /contact?topic=inspection. The topic is read
  // after mount (not with useSearchParams) so /[locale]/contact stays statically generated.
  const [topic, setTopic] = useState<Topic>("pilot");
  const message = useRef<HTMLTextAreaElement>(null);
  const ti = t.inspection;
  const inspection = topic === "inspection";

  function changeTopic(next: Topic) {
    setTopic(next);
    const box = message.current;
    if (!box) return;
    // Give the dispatcher's checklist to an empty box; take it back if it was never edited.
    if (next === "inspection" && !box.value.trim()) box.value = ti.messageStub;
    if (next === "pilot" && box.value === ti.messageStub) box.value = "";
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("topic") === "inspection") changeTopic("inspection");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    setMailto(
      `mailto:${email}?subject=${encodeURIComponent(fmt(inspection ? ti.mailSubject : t.mailSubject, { company: data.company || data.name }))}&body=${encodeURIComponent(
        `${data.message}\n\n${data.name}\n${data.company}\n${data.role}\n${data.email}`,
      )}`,
    );
    setState("sending");
    let ok = false;
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, locale: lang }) });
      ok = res.ok;
    } catch {
      ok = false;
    }
    setDelivered(ok);
    setState("sent");
    form.reset();
  }

  /** After "Send another", the reset form gets the checklist back for inspections. */
  useEffect(() => {
    if (state === "idle" && inspection && message.current && !message.current.value.trim()) message.current.value = ti.messageStub;
  }, [state, inspection, ti.messageStub]);

  if (state === "sent") {
    return (
      <div role="status" className="inner mt-6 p-6">
        <span className="grid size-11 place-items-center rounded-full bg-accent text-white">
          <Icon name="check" />
        </span>
        <p className="mt-4 font-display text-[22px] font-bold">{t.thanks}</p>
        <p className="mt-2 text-[15px] text-muted">
          {delivered ? (inspection ? ti.delivered : t.delivered) : t.notDelivered} {t.writeDirect}{" "}
          <a href={mailto} className="text-ink underline decoration-accent underline-offset-4">{email}</a>.
        </p>
        <Button variant="light" className="mt-5" onClick={() => setState("idle")}>{t.another}</Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="text-[14px] font-medium sm:col-span-2">
        {t.topic}
        <select name="topic" value={topic} onChange={(e) => changeTopic(e.target.value as Topic)} className={field}>
          <option value="pilot">{t.topics.pilot}</option>
          <option value="inspection">{t.topics.inspection}</option>
        </select>
      </label>
      {inspection && (
        <div className="inner flex gap-3 p-4 sm:col-span-2" role="note">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent text-white" aria-hidden>
            <Icon name="clock" className="size-4" />
          </span>
          <p className="text-[14px] leading-relaxed text-muted">
            <strong className="block font-display text-[16px] text-ink">{ti.title}</strong>
            {ti.note}
          </p>
        </div>
      )}
      <label className="text-[14px] font-medium">
        {t.name}
        <input name="name" required autoComplete="name" className={field} {...v} />
      </label>
      <label className="text-[14px] font-medium">
        {t.email}
        <input name="email" type="email" required autoComplete="email" className={field} {...v} />
      </label>
      <label className="text-[14px] font-medium">
        {t.company}
        <input name="company" autoComplete="organization" className={field} />
      </label>
      <label className="text-[14px] font-medium">
        {t.role}
        <select name="role" defaultValue="Developer" className={field}>
          {ROLES.map(([value, key]) => (
            <option key={value} value={value}>{t.roles[key]}</option>
          ))}
        </select>
      </label>
      <label className="text-[14px] font-medium sm:col-span-2">
        {t.message}
        <textarea
          ref={message}
          name="message"
          required
          rows={5}
          placeholder={t.messagePlaceholder}
          className={cx(field, "resize-y")}
          {...v}
        />
      </label>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <Button type="submit" variant="accent" disabled={state === "sending"}>
          {state === "sending" ? t.sending : inspection ? ti.submit : t.submit}
        </Button>
        <p className="text-[13px] text-muted">{t.privacy}</p>
      </div>
    </form>
  );
}
