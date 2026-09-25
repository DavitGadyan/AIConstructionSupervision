import { apiError, HttpError, projectForSession, requireApiSession } from "@/lib/server/auth";
import { listReports } from "@/lib/server/queries";
import { buildReport } from "@/lib/server/report";
import { fileUrl } from "@/lib/server/storage";

export const maxDuration = 120;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireApiSession(req);
    const { id } = await params;
    await projectForSession(id, s, "read");
    return Response.json(await listReports(id));
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireApiSession(req);
    const { id } = await params;
    await projectForSession(id, s, "write");
    const body = await req.json().catch(() => ({}));
    try {
      const { report } = await buildReport({ projectId: id, flightId: body.flightId || undefined, userId: s.userId });
      return Response.json({ id: report.id, url: fileUrl(report.fileKey), pages: report.pages, daysBehind: report.daysBehind }, { status: 201 });
    } catch (e) {
      throw new HttpError(422, (e as Error).message);
    }
  } catch (e) {
    return apiError(e);
  }
}
