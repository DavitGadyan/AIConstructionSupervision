import { LiveFeed } from "@/components/app/LiveFeed";
import { listFlights } from "@/lib/server/queries";
import { orderContext } from "@/components/app/orderContext";
import { requireSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live" };

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const [s, { id }] = await Promise.all([requireSession(), params]);
  const [flights, { active }] = await Promise.all([listFlights(id), orderContext(id, s)]);
  // The active inspection's events so far, newest first; new ones stream in.
  const orderItems = (active?.events ?? [])
    .map((e) => ({ kind: "order" as const, at: e.at, orderId: active!.id, number: active!.number, status: e.status, message: e.message }))
    .reverse();
  const shots = flights.flatMap((f) => f.shots).slice(0, 12).map((s) => ({ ...s, capturedAt: new Date(s.capturedAt).toISOString() }));
  return (
    <div className="space-y-4">
      <div className="px-2 pt-4">
        <h1 className="display-xl text-[44px] md:text-[72px]">Live</h1>
        <p className="mt-3 max-w-2xl text-muted">Shots stream in while the drone is still in the air (from the mobile app or an upload), followed by reconstruction, the updated schedule variance and every step of an inspection order.</p>
      </div>
      <LiveFeed projectId={id} initialShots={shots} initialOrderItems={orderItems} />
    </div>
  );
}
