import { ModelViewer } from "@/components/app/ModelViewer";
import { db } from "@/lib/server/db";
import { modelFlights } from "@/lib/server/modelData";
import { orderContext } from "@/components/app/orderContext";
import { requireSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "3D model" };

export default async function ModelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ flight?: string }> }) {
  const [s, { id }, { flight }] = await Promise.all([requireSession(), params, searchParams]);
  const [project, { access }] = await Promise.all([db.project.findUniqueOrThrow({ where: { id } }), orderContext(id, s)]);
  return (
    <div className="space-y-4">
      <div className="px-2 pt-4">
        <h1 className="display-xl text-[44px] md:text-[72px]">3D model</h1>
        <p className="mt-3 max-w-2xl text-muted">Reconstruction from the drone flight. The blue volume is what the baseline schedule says should be built by the flight date; capture a view to add it to the evidence pack.</p>
      </div>
      <ModelViewer projectId={id} flights={await modelFlights(id)} floorsTotal={project.floorsTotal} floorHeightM={project.floorHeightM} initialFlightId={flight} canCapture={access === "write"} />
    </div>
  );
}
