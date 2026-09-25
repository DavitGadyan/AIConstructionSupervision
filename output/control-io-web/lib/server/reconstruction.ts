/**
 * 3D reconstruction providers.
 *
 * - sample:  demo flights ship with a pre-built GLB (Blender, scripts/blender).
 * - nodeodm: real photogrammetry. Set NODEODM_URL to a NodeODM instance
 *            (docker run -p 3001:3000 opendronemap/nodeodm). Images are posted,
 *            the task is polled, and the textured GLB is imported.
 * - none:    no engine configured - the flight is still assessed from photos.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "./storage";
import { measureGlb } from "./glb";
import { extractFromZip } from "./unzip";

export interface ReconstructionResult {
  provider: "sample" | "nodeodm" | "none";
  status: "done" | "failed" | "skipped";
  meshKey: string | null; // storage key, or a /samples/... public path
  heightM: number | null;
  slabTopM: number | null;
  jobId?: string;
  error?: string;
}

export async function measurePublicGlb(publicPath: string) {
  const buf = await readFile(path.join(process.cwd(), "public", publicPath.replace(/^\//, "")));
  return measureGlb(buf);
}

export async function reconstructSample(meshPublicPath: string): Promise<ReconstructionResult> {
  const m = await measurePublicGlb(meshPublicPath);
  return { provider: "sample", status: "done", meshKey: meshPublicPath, heightM: m.heightM, slabTopM: m.slabTopM };
}

export async function reconstructNodeOdm(
  projectId: string,
  shotKeys: string[],
  onProgress?: (pct: number) => void,
): Promise<ReconstructionResult> {
  const base = process.env.NODEODM_URL;
  if (!base) return { provider: "none", status: "skipped", meshKey: null, heightM: null, slabTopM: null };
  try {
    const form = new FormData();
    for (const k of shotKeys) {
      const buf = await get(k);
      form.append("images", new Blob([new Uint8Array(buf)], { type: "image/jpeg" }), path.basename(k));
    }
    form.append("options", JSON.stringify([{ name: "mesh-size", value: 200000 }, { name: "auto-boundary", value: true }]));
    const created = await fetch(`${base}/task/new`, { method: "POST", body: form }).then((r) => r.json());
    const uuid: string = created.uuid;
    if (!uuid) throw new Error(created.error ?? "NodeODM did not return a task id");
    // Poll: status.code 20 running, 30 failed, 40 completed, 50 canceled
    for (let i = 0; i < 720; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const info = await fetch(`${base}/task/${uuid}/info`).then((r) => r.json());
      onProgress?.(Math.round(info.progress ?? 0));
      if (info.status?.code === 40) break;
      if (info.status?.code === 30 || info.status?.code === 50) throw new Error(info.status?.errorMessage ?? "NodeODM task failed");
    }
    const zipRes = await fetch(`${base}/task/${uuid}/download/textured_model.zip`);
    const zip = Buffer.from(new Uint8Array(await zipRes.arrayBuffer()));
    const glb = extractFromZip(zip, (n) => n.endsWith(".glb"));
    if (!glb) throw new Error("NodeODM output has no GLB (enable the 'gltf' texturing output)");
    const stored = await put(`projects/${projectId}/meshes`, "model.glb", new Uint8Array(glb.data));
    const m = measureGlb(glb.data);
    return { provider: "nodeodm", status: "done", meshKey: stored.key, heightM: m.heightM, slabTopM: m.slabTopM, jobId: uuid };
  } catch (e) {
    return { provider: "nodeodm", status: "failed", meshKey: null, heightM: null, slabTopM: null, error: (e as Error).message };
  }
}
