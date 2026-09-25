"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export function UploadDocument({ projectId, aiEnabled }: { projectId: string; aiEnabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/documents`, { method: "POST", body: new FormData(form) });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: (await res.json().catch(() => ({}))).error ?? "Upload failed" });
    form.reset();
    setMsg({ ok: true, text: aiEnabled ? "Uploaded. Claude is reading it - milestones appear here when extraction finishes." : "Uploaded and hashed. Set ANTHROPIC_API_KEY to extract milestones automatically." });
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="inner grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
      <label className="flex flex-col gap-1 text-[13px] text-muted">PDF
        <input name="file" type="file" accept="application/pdf" required className="text-[14px] text-ink file:mr-3 file:rounded-[10px] file:border-0 file:bg-ground file:px-3 file:py-2" />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-muted">Type
        <select name="kind" className="rounded-[10px] bg-ground px-3 py-2.5 text-[15px] text-ink">
          <option value="schedule">Construction schedule</option>
          <option value="permit">Building permit</option>
          <option value="contract">Contract</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-muted">Title
        <input name="title" placeholder="e.g. Baseline schedule Rev. 3" className="rounded-[10px] bg-ground px-3 py-2.5 text-[15px] text-ink" />
      </label>
      <Button type="submit" variant="accent" disabled={busy}>{busy ? "Uploading…" : "Upload"}</Button>
      {msg && <p role="status" className={`text-[14px] md:col-span-4 ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
    </form>
  );
}
