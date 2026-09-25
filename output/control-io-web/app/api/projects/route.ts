import { apiError, requireApiSession } from "@/lib/server/auth";
import { listProjects } from "@/lib/server/queries";

export async function GET(req: Request) {
  try {
    const s = await requireApiSession(req);
    return Response.json(await listProjects(s));
  } catch (e) {
    return apiError(e);
  }
}
