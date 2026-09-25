import { ModelViewer } from "@/components/app/ModelViewer";
import { getSession, projectForSession, readToken, refreshSession } from "@/lib/server/auth";
import { modelFlights } from "@/lib/server/modelData";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/** Chrome-less viewer for the mobile app's WebView (auth via ?token=). */
export default async function EmbedModel({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ token?: string; flight?: string }> }) {
  const { projectId } = await params;
  const { token, flight } = await searchParams;
  const s = await refreshSession((await readToken(token)) ?? (await getSession()));
  const project = s ? await projectForSession(projectId, s, "read").catch(() => null) : null;
  if (!project) return <p className="p-6">Sign in to view this model.</p>;
  return <ModelViewer embed projectId={projectId} flights={await modelFlights(projectId)} floorsTotal={project.floorsTotal} floorHeightM={project.floorHeightM} initialFlightId={flight} />;
}
