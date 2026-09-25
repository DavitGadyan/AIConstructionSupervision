import exifr from "exifr";
import { after } from "next/server";
import { apiError, HttpError, projectForSession, requireApiSession } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { publish } from "@/lib/server/events";
import { processFlight } from "@/lib/server/pipeline";
import { listFlights } from "@/lib/server/queries";
import { fileUrl, put } from "@/lib/server/storage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireApiSession(req);
    const { id } = await params;
    await projectForSession(id, s, "read");
    return Response.json(await listFlights(id));
  } catch (e) {
    return apiError(e);
  }
}

const IMAGE = /^image\/(jpeg|png|webp)$/;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireApiSession(req);
    const { id } = await params;
    const project = await projectForSession(id, s, "write");
    const form = await req.formData();
    // API.md and the Expo app send `files[]`; the web uploader sends `files`. Accept both.
    const files = [...form.getAll("files[]"), ...form.getAll("files")].filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new HttpError(400, "Attach at least one image as files[]");
    if (files.length > 400) throw new HttpError(400, "Up to 400 images per flight");
    for (const f of files) if (!IMAGE.test(f.type)) throw new HttpError(400, `${f.name}: only JPEG, PNG or WebP images`);

    const capturedAtField = form.get("capturedAt");
    const flight = await db.flight.create({
      data: {
        projectId: project.id,
        capturedAt: capturedAtField ? new Date(String(capturedAtField)) : new Date(),
        pilot: (form.get("pilot") as string) || s.name,
        drone: (form.get("drone") as string) || null,
        source: form.get("source") === "mobile" ? "mobile" : "upload",
        status: "uploaded",
      },
    });

    let earliest: Date | null = null;
    for (const [i, f] of files.entries()) {
      const buf = Buffer.from(await f.arrayBuffer());
      // EXIF carries the drone's GPS fix and capture time; keep both as evidence.
      const exif = await exifr.parse(buf, { gps: true, pick: ["DateTimeOriginal", "GPSAltitude", "ExifImageWidth", "ExifImageHeight", "latitude", "longitude"] }).catch(() => null);
      const lat = typeof exif?.latitude === "number" ? exif.latitude : parseFloat(String(form.get("lat") ?? "")) || null;
      const lng = typeof exif?.longitude === "number" ? exif.longitude : parseFloat(String(form.get("lng") ?? "")) || null;
      const capturedAt: Date = exif?.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal : flight.capturedAt;
      if (!earliest || capturedAt < earliest) earliest = capturedAt;
      const stored = await put(`projects/${project.id}/flights/${flight.id}`, f.name || `shot-${i}.jpg`, buf);
      const shot = await db.shot.create({
        data: {
          flightId: flight.id,
          fileKey: stored.key,
          sha256: stored.sha256,
          view: (form.get("view") as string) || "orbit",
          label: f.name,
          capturedAt,
          lat,
          lng,
          altM: typeof exif?.GPSAltitude === "number" ? exif.GPSAltitude : parseFloat(String(form.get("altM") ?? "")) || null,
          width: exif?.ExifImageWidth ?? null,
          height: exif?.ExifImageHeight ?? null,
        },
      });
      publish(project.id, "shot", { flightId: flight.id, shot: { ...shot, url: fileUrl(shot.fileKey), thumbUrl: fileUrl(shot.fileKey) } });
    }
    if (!capturedAtField && earliest) await db.flight.update({ where: { id: flight.id }, data: { capturedAt: earliest } });

    // Reconstruction + assessment can take minutes; respond now, finish after.
    after(() => processFlight(flight.id));
    return Response.json({ id: flight.id, status: "uploaded" }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
