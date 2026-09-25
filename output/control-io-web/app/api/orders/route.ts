import { apiError, HttpError, requireApiSession, validate } from "@/lib/server/auth";
import { CreateOrderSchema, createOrder, listOrders } from "@/lib/server/orders";

export const dynamic = "force-dynamic";

/** Orders on ?projectId= (or on every project the caller can read), newest first. */
export async function GET(req: Request) {
  try {
    const s = await requireApiSession(req);
    const projectId = new URL(req.url).searchParams.get("projectId");
    return Response.json(await listOrders(s, projectId));
  } catch (e) {
    return apiError(e);
  }
}

/** Places an inspection order: 201 Order | 400 | 403 | 404 | 409 { activeOrderId } | 422. */
export async function POST(req: Request) {
  try {
    const s = await requireApiSession(req);
    const body = await req.json().catch(() => {
      throw new HttpError(400, "Body must be JSON");
    });
    const input = validate(CreateOrderSchema, body, "Invalid order");
    return Response.json(await createOrder(s, input), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
