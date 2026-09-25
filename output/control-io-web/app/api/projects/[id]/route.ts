import { apiError, projectForSession, requireApiSession } from "@/lib/server/auth";
import { projectSummary } from "@/lib/server/queries";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireApiSession(req);
    const { id } = await params;
    await projectForSession(id, s, "read");
    const flightId = new URL(req.url).searchParams.get("flight") ?? undefined;
    return Response.json(await projectSummary(id, flightId));
  } catch (e) {
    return apiError(e);
  }
}
