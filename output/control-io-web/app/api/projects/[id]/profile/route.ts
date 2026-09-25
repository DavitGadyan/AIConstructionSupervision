import { apiError, requireApiSession } from "@/lib/server/auth";
import { projectProfile } from "@/lib/server/profile";

export const dynamic = "force-dynamic";

/** Project details, status, recent documents/reports, the active order and the caller's access. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireApiSession(req);
    const { id } = await params;
    return Response.json(await projectProfile(s, id));
  } catch (e) {
    return apiError(e);
  }
}
