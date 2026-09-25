import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/primitives";
import { OrderTracker } from "@/components/app/OrderTracker";
import { HttpError, requireSession } from "@/lib/server/auth";
import { getOrder } from "@/lib/server/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inspection order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string; orderId: string }> }) {
  const [s, { id, orderId }] = await Promise.all([requireSession(), params]);
  // getOrder advances the order to now and computes canCancel for this caller.
  const order = await getOrder(s, orderId).catch((e) => {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  });
  if (!order) notFound();
  if (order.projectId !== id) redirect(`/app/projects/${order.projectId}/orders/${order.id}`);
  return (
    <div className="space-y-2">
      <div className="px-2 pt-4">
        <Breadcrumbs
          items={[
            { name: "Orders", href: `/app/projects/${id}/orders` },
            { name: order.number, href: `/app/projects/${id}/orders/${order.id}` },
          ]}
        />
      </div>
      <OrderTracker initial={order} initialNow={Date.now()} variant="page" />
    </div>
  );
}
