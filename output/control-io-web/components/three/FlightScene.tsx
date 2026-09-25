"use client";

/**
 * The "drone flight → 3D model" explainer scene (components/marketing/FlightExplainer.tsx).
 * Everything is the real sample data: the photo-textured September tower and the six drone photos,
 * placed at the capture positions used to shoot them (scripts/blender/build_tower_pbr.py shoot()).
 * Step 0 flies the drone along the route and pops out each photo, 1 grows a point cloud sampled from
 * the model storey by storey, 2 fades the photo-textured mesh in, 3 marks built vs planned storeys.
 */
import { Environment, Html, Line, useGLTF, useTexture } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import staticImageLoader from "@/lib/imageLoader";
import { STATIC_SITE } from "@/lib/siteMode";

const SITE = /^(Ground|SitePad|GravelYard|Road|Neighbour|Fence|Container|Rebar\d|Formstack|Crane|Jib|CounterWeight|Cab|Hoist|HookLoad)/;
const FLOOR = 3.2;
const BASE = 0.8;
const BUILT = 12;
const PLANNED = 14;
const H = 44; // top of the September structure, metres
const MID = new THREE.Vector3(0, H * 0.45, 0);
const POINTS = 40000;

/**
 * Capture stops in flight order: the plate-script positions (build_tower_pbr.py shoot(), Blender Z-up)
 * as three.js Y-up, pulled in to ~60 % so the route and the building both fit the frame.
 */
const STOPS = [
  { name: "orbit-sw", pos: [-38, H + 14, 42], target: MID },
  { name: "facade-s", pos: [0, H * 0.55, 30], target: new THREE.Vector3(0, H * 0.5, 0) },
  { name: "orbit-se", pos: [44, H + 10, 35], target: MID },
  { name: "orbit-ne", pos: [37, H + 18, -40], target: MID },
  { name: "nadir", pos: [0.01, H + 28, 0.01], target: new THREE.Vector3(0, 0, 0) },
  { name: "deck", pos: [-16, H + 8, 20], target: new THREE.Vector3(0, H, 0) },
] as const;

const ROUTE = new THREE.CatmullRomCurve3(
  [new THREE.Vector3(-26, 1.5, 30), ...STOPS.map((s) => new THREE.Vector3(...s.pos))],
  false,
  "centripetal",
);
/** Route parameter (0..1) at which each stop is reached. */
const STOP_T = STOPS.map((_, i) => (i + 1) / STOPS.length);
const FLY_SECONDS = 9;

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function useSmoothStep(step: number, reduced: boolean) {
  const v = useRef(step);
  useFrame((_, dt) => {
    v.current = reduced ? step : v.current + (step - v.current) * Math.min(1, dt * 2.2);
  });
  return v;
}

/* --------------------------------------------------------------------------------------------- */

function Drone({ t }: { t: React.RefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  const rotors = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!g.current) return;
    const u = clamp01(t.current);
    const p = ROUTE.getPointAt(u);
    g.current.position.copy(p);
    g.current.lookAt(MID.x, p.y, MID.z);
    if (rotors.current) rotors.current.rotation.y += dt * 40;
  });
  return (
    <group ref={g} scale={2.2}>
      <mesh>
        <boxGeometry args={[1.1, 0.35, 1.1]} />
        <meshStandardMaterial color="#f4f6f7" roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.35, 0.3]}>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshStandardMaterial color="#1c2226" roughness={0.3} />
      </mesh>
      <group ref={rotors}>
        {[
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x * 0.85, 0.22, z * 0.85]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.55, 20]} />
            <meshBasicMaterial color="#0A8FA3" transparent opacity={0.55} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Stop({ i, t, step }: { i: number; t: React.RefObject<number>; step: React.RefObject<number> }) {
  const s = STOPS[i];
  // a 640 px variant is plenty for a 15 m photo card (static site; the server app serves the original)
  const tex = useTexture(STATIC_SITE ? staticImageLoader({ src: `/images/flights/m8/${s.name}.webp`, width: 640 }) : `/images/flights/m8/${s.name}.webp`);
  tex.colorSpace = THREE.SRGBColorSpace;
  const group = useRef<THREE.Group>(null);
  const photo = useRef<THREE.Mesh>(null);
  const frustum = useMemo(() => {
    const apex = new THREE.Vector3(...s.pos);
    const dir = s.target.clone().sub(apex).normalize();
    const up = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const u = new THREE.Vector3().crossVectors(right, dir).normalize();
    const c = apex.clone().add(dir.clone().multiplyScalar(7));
    const w = 4.5, h = 3;
    const corners = [
      c.clone().add(right.clone().multiplyScalar(w)).add(u.clone().multiplyScalar(h)),
      c.clone().add(right.clone().multiplyScalar(-w)).add(u.clone().multiplyScalar(h)),
      c.clone().add(right.clone().multiplyScalar(-w)).add(u.clone().multiplyScalar(-h)),
      c.clone().add(right.clone().multiplyScalar(w)).add(u.clone().multiplyScalar(-h)),
    ];
    const lines: THREE.Vector3[][] = corners.map((k) => [apex, k]);
    lines.push([...corners, corners[0]]);
    // the photo floats just outside the frustum, facing back along the view ray
    const photoPos = apex.clone().add(dir.clone().multiplyScalar(-4)).add(u.clone().multiplyScalar(8));
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right.clone().negate(), u, dir.clone().negate()));
    return { lines, photoPos, quat };
  }, [s]);
  useFrame(() => {
    const shown = t.current >= STOP_T[i] - 0.01 ? 1 : 0;
    const fade = clamp01(1.4 - step.current); // photos give way to the point cloud
    const k = shown * (0.25 + 0.75 * fade);
    if (group.current) group.current.visible = k > 0.02 && step.current < 2.6;
    if (photo.current) {
      const m = photo.current.material as THREE.MeshBasicMaterial;
      m.opacity = k;
      photo.current.scale.setScalar(0.6 + 0.4 * fade);
    }
  });
  return (
    <group ref={group}>
      {frustum.lines.map((pts, j) => (
        <Line key={j} points={pts} color="#0A8FA3" lineWidth={1.4} transparent opacity={0.85} />
      ))}
      <mesh ref={photo} position={frustum.photoPos} quaternion={frustum.quat}>
        <planeGeometry args={[15, 10]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* --------------------------------------------------------------------------------------------- */

function sampleCloud(meshes: THREE.Mesh[]) {
  const areas = meshes.map((m) => {
    const s = new MeshSurfaceSampler(m).build();
    const d = (s as unknown as { distribution: Float32Array }).distribution;
    return { s, m, area: d[d.length - 1] * Math.abs(m.matrixWorld.determinant()) ** (2 / 3) };
  });
  const total = areas.reduce((a, b) => a + b.area, 0) || 1;
  const pos: number[] = [];
  const col: number[] = [];
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  for (const { s, m, area } of areas) {
    const n = Math.round((POINTS * area) / total);
    const name = (Array.isArray(m.material) ? m.material[0] : m.material)?.name ?? "";
    const base = /Net/i.test(name) || /Net/.test(m.name) ? "#3f7d6c" : /Glass/i.test(m.name + name) ? "#4c5f6d" : /Plywood|Form/i.test(m.name + name) ? "#b08c5f" : "#b9b5ad";
    for (let k = 0; k < n; k++) {
      s.sample(p);
      p.applyMatrix4(m.matrixWorld);
      pos.push(p.x, p.y, p.z);
      c.set(base).offsetHSL(0, 0, (Math.random() - 0.5) * 0.12);
      col.push(c.r, c.g, c.b);
    }
  }
  // storey by storey: sort by height so a growing draw range fills the tower from the ground up
  const idx = [...Array(pos.length / 3).keys()].sort((a, b) => pos[a * 3 + 1] - pos[b * 3 + 1]);
  const P = new Float32Array(pos.length);
  const C = new Float32Array(col.length);
  idx.forEach((j, k) => {
    P.set(pos.slice(j * 3, j * 3 + 3), k * 3);
    C.set(col.slice(j * 3, j * 3 + 3), k * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(P, 3));
  g.setAttribute("color", new THREE.BufferAttribute(C, 3));
  return g;
}

function Tower({ src, step }: { src: string; step: React.RefObject<number> }) {
  const { scene } = useGLTF(src);
  const { model, mats, cloud } = useMemo(() => {
    const c = scene.clone(true);
    const drop: THREE.Object3D[] = [];
    c.traverse((o) => SITE.test(o.name) && drop.push(o));
    drop.forEach((o) => o.removeFromParent());
    c.updateMatrixWorld(true);
    const mats: THREE.MeshStandardMaterial[] = [];
    const meshes: THREE.Mesh[] = [];
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes.push(m);
      // own materials: the explorer shares the cached GLB and must not fade with us
      const own = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => {
        const k = (x as THREE.MeshStandardMaterial).clone();
        k.transparent = true;
        k.envMapIntensity = /^Proj_/.test(k.name) ? 0.35 : 1;
        mats.push(k);
        return k;
      });
      m.material = Array.isArray(m.material) ? own : own[0];
    });
    return { model: c, mats, cloud: sampleCloud(meshes) };
  }, [scene]);
  const pts = useRef<THREE.Points>(null);
  useFrame(() => {
    const st = step.current;
    const meshOpacity = ease(clamp01(st - 1.5));
    for (const m of mats) {
      m.opacity = meshOpacity;
      m.depthWrite = meshOpacity > 0.95;
    }
    model.visible = meshOpacity > 0.01;
    if (pts.current) {
      const grow = ease(clamp01(st - 0.6));
      const n = Math.floor((cloud.attributes.position.count as number) * grow);
      cloud.setDrawRange(0, n);
      const pm = pts.current.material as THREE.PointsMaterial;
      pm.opacity = 1 - ease(clamp01(st - 1.7));
      pts.current.visible = n > 0 && pm.opacity > 0.02;
    }
  });
  useEffect(() => () => cloud.dispose(), [cloud]);
  return (
    <>
      <primitive object={model} />
      <points ref={pts} geometry={cloud}>
        <pointsMaterial size={0.42} vertexColors transparent sizeAttenuation depthWrite={false} />
      </points>
    </>
  );
}

function Measure({ step, labels }: { step: React.RefObject<number>; labels: { built: string; planned: string } }) {
  const g = useRef<THREE.Group>(null);
  const tag = useRef<HTMLDivElement>(null);
  const rect = (y: number, pad = 0.6): THREE.Vector3[] => {
    const x = 12 + pad, z = 8.4 + pad;
    return [new THREE.Vector3(-x, y, -z), new THREE.Vector3(x, y, -z), new THREE.Vector3(x, y, z), new THREE.Vector3(-x, y, z), new THREE.Vector3(-x, y, -z)];
  };
  useFrame(() => {
    const k = ease(clamp01(step.current - 2.4));
    if (g.current) g.current.visible = k > 0.02;
    if (tag.current) tag.current.style.opacity = String(k);
  });
  return (
    <group ref={g}>
      {Array.from({ length: BUILT }, (_, f) => (
        <Line key={f} points={rect(BASE + (f + 1) * FLOOR)} color="#0A8FA3" lineWidth={1.6} />
      ))}
      {Array.from({ length: PLANNED - BUILT }, (_, f) => (
        <mesh key={f} position={[0, BASE + (BUILT + f + 0.5) * FLOOR, 0]}>
          <boxGeometry args={[24.4, FLOOR - 0.2, 16.8]} />
          <meshBasicMaterial color="#d6453d" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
      <Html position={[13.5, BASE + PLANNED * FLOOR + 3, 0]} zIndexRange={[20, 0]}>
        <div ref={tag} className="pointer-events-none w-max rounded-[12px] bg-white/90 px-3 py-2 text-[13px] leading-snug text-ink shadow-md backdrop-blur" style={{ opacity: 0 }}>
          <span className="block font-semibold text-[#c23b33]">{labels.planned}</span>
          <span className="block">{labels.built}</span>
        </div>
      </Html>
    </group>
  );
}

function Rig({ step, reduced, active, children }: { step: number; reduced: boolean; active: boolean; children: (t: React.RefObject<number>, s: React.RefObject<number>) => React.ReactNode }) {
  const t = useRef(reduced ? 1 : 0);
  const s = useSmoothStep(step, reduced);
  const world = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!active) return;
    // the drone flies during step 1 and has landed its last photo by the time the cloud grows
    t.current = reduced || step > 0 ? 1 : (t.current + dt / FLY_SECONDS) % 1.12;
    if (world.current && !reduced) world.current.rotation.y += dt * 0.05;
  });
  return <group ref={world}>{children(t, s)}</group>;
}

export function FlightScene({
  src,
  step,
  reduced,
  active,
  label,
  measureLabels,
}: {
  src: string;
  step: number;
  reduced: boolean;
  active: boolean;
  label: string;
  measureLabels: { built: string; planned: string };
}) {
  return (
    <Canvas
      aria-label={label}
      role="img"
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.6]}
      camera={{ position: [92, 68, 92], fov: 38, near: 1, far: 2000 }}
      onCreated={({ camera }) => camera.lookAt(0, 30, 0)}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
    >
      <hemisphereLight args={["#e6eef3", "#8c8173", 0.6]} />
      <directionalLight position={[60, 120, 40]} intensity={2.2} color="#fff4e6" />
      <Suspense fallback={null}>
        <Environment files="/hdri/sky.hdr" environmentIntensity={0.8} />
        <Rig step={step} reduced={reduced} active={active}>
          {(t, s) => (
            <>
              <Line points={ROUTE.getSpacedPoints(160)} color="#0A8FA3" lineWidth={1.2} dashed dashSize={2} gapSize={1.6} transparent opacity={0.7} />
              <Drone t={t} />
              {STOPS.map((_, i) => (
                <Stop key={i} i={i} t={t} step={s} />
              ))}
              <Tower src={src} step={s} />
              <Measure step={s} labels={measureLabels} />
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]}>
                <circleGeometry args={[52, 64]} />
                <meshStandardMaterial color="#d6dadc" roughness={1} transparent opacity={0.9} />
              </mesh>
            </>
          )}
        </Rig>
      </Suspense>
    </Canvas>
  );
}
