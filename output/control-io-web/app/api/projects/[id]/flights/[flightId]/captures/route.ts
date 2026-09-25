import { apiError, HttpError, projectForSession, requireApiSession } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { publish } from "@/lib/server/events";
import { fileUrl, put } from "@/lib/server/storage";

/** Saves a 3D-viewer screenshot as evidence on a flight. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; flightId: string }> }) {
  try {
    const s = await requireApiSession(req);
    const { id, flightId } = await params;
    await projectForSession(id, s, "write");
    const flight = await db.flight.findFirst({ where: { id: flightId, projectId: id } });
    if (!flight) throw new HttpError(404, "Flight not found");
    const { dataUrl, label } = await req.json();
    const m = /^data:image\/png;base64,(.+)$/.exec(String(dataUrl ?? ""));
    if (!m) throw new HttpError(400, "dataUrl must be a PNG data URL");
    const buf = Buffer.from(m[1], "base64");
    if (buf.byteLength > 15_000_000) throw new HttpError(413, "Capture too large");
    const stored = await put(`projects/${id}/flights/${flightId}`, "capture.png", buf);
    const shot = await db.shot.create({
      data: { flightId, fileKey: stored.key, sha256: stored.sha256, view: "model-capture", label: String(label || "3D model capture").slice(0, 120), capturedAt: new Date() },
    });
    const out = { ...shot, url: fileUrl(shot.fileKey), thumbUrl: fileUrl(shot.fileKey) };
    publish(id, "shot", { flightId, shot: out });
    return Response.json(out, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
