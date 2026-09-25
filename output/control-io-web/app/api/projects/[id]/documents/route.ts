import { after } from "next/server";
import { PDFDocument } from "pdf-lib";
import { apiError, HttpError, projectForSession, requireApiSession } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { ingestDocument } from "@/lib/server/pipeline";
import { listDocuments } from "@/lib/server/queries";
import { put } from "@/lib/server/storage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireApiSession(req);
    const { id } = await params;
    await projectForSession(id, s, "read");
    return Response.json(await listDocuments(id));
  } catch (e) {
    return apiError(e);
  }
}

const KINDS = ["schedule", "permit", "contract", "other"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireApiSession(req);
    const { id } = await params;
    await projectForSession(id, s, "write");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new HttpError(400, "Attach a PDF as file");
    if (file.type !== "application/pdf") throw new HttpError(400, "Only PDF documents");
    if (file.size > 30_000_000) throw new HttpError(413, "PDF over 30 MB");
    const kind = KINDS.includes(String(form.get("kind"))) ? String(form.get("kind")) : "other";
    const buf = Buffer.from(await file.arrayBuffer());
    const pages = await PDFDocument.load(buf, { ignoreEncryption: true }).then((d) => d.getPageCount()).catch(() => 0);
    const stored = await put(`projects/${id}/documents`, file.name, buf);
    const doc = await db.document.create({
      data: { projectId: id, kind, title: String(form.get("title") || file.name.replace(/\.pdf$/i, "")), fileKey: stored.key, sha256: stored.sha256, pages },
    });
    if (kind === "schedule" || kind === "contract" || kind === "permit") after(() => ingestDocument(doc.id));
    return Response.json(doc, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
