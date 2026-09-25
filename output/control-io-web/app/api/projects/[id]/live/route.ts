import { apiError, projectForSession, requireApiSession } from "@/lib/server/auth";
import { subscribe } from "@/lib/server/events";
import { canCancel } from "@/lib/domain/dispatch";
import type { OrderDto } from "@/lib/domain/orderTypes";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events: new shots, pipeline status, findings and inspection
 * orders for one project. Only callers who can read the project subscribe;
 * each `order` payload's `canCancel` is recomputed for this subscriber
 * (role, access, whether their org placed the order).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireApiSession(req);
    const { id } = await params;
    const project = await projectForSession(id, s, "read");
    const personalise = (event: string, data: unknown) => {
      if (event !== "order" || !data || typeof data !== "object") return data;
      const o = data as OrderDto;
      if (o.projectId !== id) return null; // never leak another project's order
      return { ...o, canCancel: canCancel(o.status, { role: s.role, access: project.access, orderedByCallerOrg: o.orgId === s.orgId }) };
    };
    const enc = new TextEncoder();
    let cleanup = () => {};
    const stream = new ReadableStream({
      start(controller) {
        const send = (event: string, data: unknown) => {
          const payload = personalise(event, data);
          if (payload === null) return;
          try {
            controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
          } catch {
            cleanup();
          }
        };
        send("ping", { at: new Date().toISOString() });
        const unsub = subscribe(id, send);
        const timer = setInterval(() => send("ping", { at: new Date().toISOString() }), 20_000);
        cleanup = () => {
          clearInterval(timer);
          unsub();
        };
        req.signal.addEventListener("abort", () => {
          cleanup();
          try {
            controller.close();
          } catch {}
        });
      },
      cancel() {
        cleanup();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
    });
  } catch (e) {
    return apiError(e);
  }
}
