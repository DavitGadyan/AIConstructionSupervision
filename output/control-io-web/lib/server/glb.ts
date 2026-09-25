/**
 * Minimal GLB inspector: vertical extent of the building in a reconstruction.
 * Works on our sample meshes (named nodes: Tower > Floor_nn > Slab_n) and on
 * anonymous photogrammetry meshes (whole-model bounding box above ground).
 */
interface GltfNode { name?: string; mesh?: number; children?: number[]; translation?: number[]; scale?: number[]; matrix?: number[] }
interface Gltf {
  nodes?: GltfNode[];
  meshes?: { primitives: { attributes: { POSITION?: number } }[] }[];
  accessors?: { min?: number[]; max?: number[]; normalized?: boolean; componentType?: number }[];
  scenes?: { nodes: number[] }[];
}

export function readGlbJson(buf: Buffer): Gltf {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB file");
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + len).toString("utf8"));
}

export function measureGlb(buf: Buffer): { heightM: number; slabTopM: number | null } {
  const g = readGlbJson(buf);
  const nodes = g.nodes ?? [];
  let minY = Infinity, maxY = -Infinity, slabTop = -Infinity;
  const visit = (i: number, ty: number, sy: number) => {
    const n = nodes[i];
    // Y translation/scale from TRS or a column-major matrix (quantized meshes carry a dequantizing transform).
    const y = ty + (n.matrix ? n.matrix[13] : (n.translation?.[1] ?? 0)) * sy;
    const s = sy * (n.matrix ? n.matrix[5] : (n.scale?.[1] ?? 1));
    if (n.mesh != null) {
      for (const p of g.meshes?.[n.mesh]?.primitives ?? []) {
        const a = p.attributes.POSITION != null ? g.accessors?.[p.attributes.POSITION] : undefined;
        if (!a?.min || !a?.max) continue;
        // KHR_mesh_quantization: normalized integer components map to [-1,1] / [0,1].
        const norm = a.normalized ? ({ 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 } as Record<number, number>)[a.componentType ?? 0] ?? 1 : 1;
        const lo = y + (a.min[1] / norm) * s, hi = y + (a.max[1] / norm) * s;
        const isSite = /^(Ground|SitePad|GravelYard|Road|Neighbour|Fence|Container|Rebar\d|Formstack|Crane|Jib|Hoist|CounterWeight|Cab|HookLoad)/.test(n.name ?? "");
        if (!isSite) {
          minY = Math.min(minY, lo);
          maxY = Math.max(maxY, hi);
        }
        if (/^Slab_/.test(n.name ?? "")) slabTop = Math.max(slabTop, hi);
      }
    }
    for (const c of n.children ?? []) visit(c, y, s);
  };
  for (const r of g.scenes?.[0]?.nodes ?? nodes.map((_, i) => i)) visit(r, 0, 1);
  const ground = Math.max(0, minY === Infinity ? 0 : minY);
  return {
    heightM: maxY === -Infinity ? 0 : maxY - ground,
    slabTopM: slabTop === -Infinity ? null : slabTop - ground,
  };
}
