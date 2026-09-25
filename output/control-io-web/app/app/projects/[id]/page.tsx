import { Dashboard } from "@/components/app/Dashboard";
import { orderContext } from "@/components/app/orderContext";
import { requireSession } from "@/lib/server/auth";
import { projectSummary } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function ProjectDashboard({ params }: { params: Promise<{ id: string }> }) {
  const [s, { id }] = await Promise.all([requireSession(), params]);
  // The layout has already checked read access; orderContext is cached per request.
  const [summary, ctx] = await Promise.all([projectSummary(id), orderContext(id, s)]);
  return <Dashboard s={summary} orders={{ active: ctx.active, canOrder: ctx.canOrder, access: ctx.access, now: Date.now() }} />;
}
