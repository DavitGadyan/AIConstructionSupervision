import { apiError, requireApiSession, validate } from "@/lib/server/auth";
import { QuoteQuerySchema } from "@/lib/server/orders";
import { quote } from "@/lib/domain/pricing";

/** GET /api/orders/quote?kind=full|revision|targeted&priority=asap|scheduled */
export async function GET(req: Request) {
  try {
    await requireApiSession(req);
    const q = Object.fromEntries(new URL(req.url).searchParams);
    const { kind, priority } = validate(QuoteQuerySchema, q, "Invalid quote request");
    return Response.json(quote(kind, priority));
  } catch (e) {
    return apiError(e);
  }
}
