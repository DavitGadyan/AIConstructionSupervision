"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";

/** Drag-and-drop drone photo upload. EXIF GPS/time is read server-side. */
export function UploadFlight({ projectId }: { projectId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [drag, setDrag] = useState(false);

  async function upload() {
    if (!files.length) return;
    setState("uploading");
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    fd.append("source", "upload");
    const res = await fetch(`/api/projects/${projectId}/flights`, { method: "POST", body: fd });
    if (!res.ok) {
      setState("error");
      setMsg((await res.json().catch(() => ({}))).error ?? "Upload failed");
      return;
    }
    setState("done");
    setMsg(`${files.length} shot${files.length > 1 ? "s" : ""} uploaded. Processing continues in the background - follow it on Live.`);
    setFiles([]);
    router.refresh();
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); setFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))); }}
      className={`inner flex flex-col items-center gap-3 border-2 border-dashed p-6 text-center transition ${drag ? "border-accent bg-accent-soft" : "border-line"}`}
    >
      <p className="font-display text-[18px] font-semibold">Drop drone photos here</p>
      <p className="max-w-sm text-[14px] text-muted">JPEG/PNG straight from the drone - GPS, altitude and capture time are read from EXIF and hashed as evidence.</p>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="light" onClick={() => input.current?.click()}>Choose files</Button>
        <Button variant="accent" onClick={upload} disabled={!files.length || state === "uploading"}>
          {state === "uploading" ? "Uploading…" : files.length ? `Upload ${files.length} shot${files.length > 1 ? "s" : ""}` : "Upload flight"}
        </Button>
      </div>
      {msg && <p role="status" className={`text-[14px] ${state === "error" ? "text-danger" : "text-ok"}`}>{msg}</p>}
    </div>
  );
}
