import { apiError, requireApiSession } from "@/lib/server/auth";
import { cancelOrder } from "@/lib/server/orders";

/** Cancels an order while requested | confirmed | dispatched: 200 Order | 403 | 404 | 409. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireApiSession(req);
    const { id } = await params;
    return Response.json(await cancelOrder(s, id));
  } catch (e) {
    return apiError(e);
  }
}
