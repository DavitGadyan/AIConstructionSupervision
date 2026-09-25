import { apiError, requireApiSession } from "@/lib/server/auth";
import { getOrder } from "@/lib/server/orders";

export const dynamic = "force-dynamic";

/** One order (by id, or by number "INS-2026-0007"), advanced to now. 404 if not visible. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireApiSession(req);
    const { id } = await params;
    return Response.json(await getOrder(s, id));
  } catch (e) {
    return apiError(e);
  }
}
