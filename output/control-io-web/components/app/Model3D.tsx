"use client";

import dynamic from "next/dynamic";

/** Client-only wrapper: three.js must never render on the server. */
export const Model3D = dynamic(() => import("@/components/three/TowerModel").then((m) => m.TowerModel), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center text-[13px] text-muted">Loading 3D model…</div>,
});
