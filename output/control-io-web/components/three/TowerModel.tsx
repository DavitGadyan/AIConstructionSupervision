"use client";

/**
 * GLB viewer used by the landing hero, the home-page explorer, the dashboard,
 * the app's 3D page and the mobile embed.
 *
 * - `variant="hero"`: transparent, slow turntable, no controls - the ORDI
 *   centre object. No post-processing, so it stays light.
 * - `variant="viewer"`: orbit controls, optional planned-floor ghost overlay,
 *   floor slicer, issue markers and a capture() handle that returns a PNG data
 *   URL for evidence screenshots.
 * - `variant="explorer"`: the marketing defect explorer - bounded orbit,
 *   gentle auto-rotate until the first interaction, issue markers with a
 *   camera fly-to on selection, and `frameloop="demand"` while idle.
 *
 * Realism: ACES filmic tone mapping into sRGB, physically based lights, an
 * HDRI environment (falls back to drei's "city" preset when
 * /hdri/sky.hdr is missing), PCF soft shadows from a sun whose shadow camera
 * is sized to the tower, and on capable devices N8AO + SMAA + a subtle
 * vignette for the viewer and explorer.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bounds, ContactShadows, Environment, Html, OrbitControls, useBounds, useGLTF } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { forwardRef, memo, Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { KindIcon, MarkerButton, type MarkerKind, type MarkerSeverity } from "./markers";

export interface TowerModelHandle {
  capture: () => string | null;
  /** fly back to the default framing */
  resetView: () => void;
}

export type { MarkerKind, MarkerSeverity };
export { KindIcon };

export interface TowerMarker {
  id: string;
  /** GLB space, Y up, metres */
  position: [number, number, number];
  severity: MarkerSeverity;
  kind: MarkerKind;
  /** accessible name, e.g. "Floor 13 frame 40% complete, critical delay" */
  label: string;
  /** where the camera flies to when selected; derived from position if omitted */
  camera?: [number, number, number];
}

interface Props {
  src: string;
  variant?: "hero" | "viewer" | "explorer";
  /** show a translucent box for floors the plan expected by now */
  plannedFloors?: number;
  floorsTotal?: number;
  floorHeightM?: number;
  /** hide geometry above this storey (viewer/explorer) */
  sliceFloor?: number | null;
  className?: string;
  /** hide the surrounding site (ground, neighbours, crane) */
  towerOnly?: boolean;
  /** fires once the GLB is in the scene */
  onLoaded?: () => void;
  /** issue pins rendered over the model (viewer/explorer) */
  markers?: TowerMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** first pointer/wheel/keyboard interaction with the canvas */
  onInteract?: () => void;
  /** force post-processing on/off; default: auto (viewer/explorer on capable devices) */
  effects?: boolean;
  /** subtle bloom on highlights - off by default */
  bloom?: boolean;
}

const SITE = /^(Ground|SitePad|GravelYard|Road|Neighbour|Fence|Container|Rebar\d|Formstack|Crane|Jib|CounterWeight|Cab|Hoist|HookLoad)/;
const HDRI = "/hdri/sky.hdr";
const SKY_LDR = "/hdri/sky-4k.webp";

function usePrefersReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

/* The HDRI is optional: one HEAD request per page decides file vs preset. */
let hdriCheck: Promise<boolean> | null = null;
function hdriAvailable() {
  hdriCheck ??= fetch(HDRI, { method: "HEAD" })
    .then((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html"))
    .catch(() => false);
  return hdriCheck;
}

/**
 * The visible sky: a tone-mapped 4k equirect of the same HDRI. The 1k HDR that
 * lights the scene is far too soft to look at; this one replaces it as the
 * backdrop once it has loaded (the HDR stays as the fallback backdrop).
 */
function SkyBackdrop() {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let live = true;
    let tex: THREE.Texture | null = null;
    new THREE.TextureLoader().load(
      SKY_LDR,
      (t) => {
        if (!live) return t.dispose();
        t.mapping = THREE.EquirectangularReflectionMapping;
        t.colorSpace = THREE.SRGBColorSpace;
        tex = t;
        scene.background = t;
        scene.backgroundBlurriness = 0;
        invalidate();
      },
      undefined,
      () => {
        /* keep the HDR backdrop */
      },
    );
    return () => {
      live = false;
      if (tex && scene.background === tex) scene.background = null;
      tex?.dispose();
    };
  }, [scene, invalidate]);
  return null;
}

function SceneEnvironment({ sky = false }: { sky?: boolean }) {
  const [hdri, setHdri] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    hdriAvailable().then((ok) => live && setHdri(ok));
    return () => {
      live = false;
    };
  }, []);
  if (hdri == null) return null;
  // `sky`: show the real sky as the backdrop (explorer/viewer) - a grey void reads as a render, a sky reads as a photo.
  return hdri ? (
    <>
      <Environment files={HDRI} background={sky} backgroundBlurriness={0.04} environmentIntensity={0.9} />
      {sky && <SkyBackdrop />}
    </>
  ) : (
    <Environment preset="city" background={false} environmentIntensity={0.9} />
  );
}

function Model({
  src,
  sliceFloor,
  floorHeightM = 3.2,
  towerOnly,
  spin,
  onLoaded,
  modelRef,
}: {
  src: string;
  sliceFloor?: number | null;
  floorHeightM?: number;
  towerOnly?: boolean;
  spin: boolean;
  onLoaded?: () => void;
  modelRef?: MutableRefObject<THREE.Object3D | null>;
}) {
  const { scene } = useGLTF(src);
  const invalidate = useThree((s) => s.invalidate);
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  // Site props are removed (not just hidden) so camera framing fits the tower.
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    if (towerOnly) {
      const drop: THREE.Object3D[] = [];
      c.traverse((o) => {
        if (SITE.test(o.name)) drop.push(o);
      });
      drop.forEach((o) => o.removeFromParent());
    }
    return c;
  }, [scene, towerOnly]);
  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    if (modelRef) modelRef.current = cloned;
    onLoaded?.();
  }, [cloned, onLoaded, modelRef]);

  useEffect(() => {
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // PBR textures from the regenerated GLBs: keep the colour maps in sRGB
      // and let the environment do the rest.
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
      for (const m of mats) {
        if (!m || !("envMapIntensity" in m)) continue;
        // Photo-projected faces (scripts/blender/project_photos.py) already carry the
        // sky's ambient light in the photograph; a full HDRI on top washes them out.
        m.envMapIntensity = /^Proj_/.test(m.name) ? (m.name.endsWith("_glass") ? 0.6 : 0.35) : 1;
        // Sharp textures at grazing drone angles instead of a smeared ground.
        for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = maxAniso;
        // The CC0 grass scan is sun-bleached yellow and tiles visibly over 800 m;
        // pull it towards trampled site earth so the eye stays on the building.
        if (/Grass/i.test(m.name) && !m.userData.cioToned) {
          m.color.set("#7d7a6c");
          m.roughness = 1;
          m.userData.cioToned = true;
        }
      }
      const n = mesh.name;
      // Blender exports object names; site props are dropped in towerOnly mode.
      let visible = true;
      if (sliceFloor != null) {
        const box = new THREE.Box3().setFromObject(mesh);
        if (box.min.y > sliceFloor * floorHeightM + 0.8 + 0.1 && !/^(Ground|SitePad|Road|Neighbour|Fence)/.test(n)) visible = false;
      }
      mesh.visible = visible;
    });
    invalidate();
  }, [cloned, sliceFloor, floorHeightM, towerOnly, invalidate]);

  useFrame((_, dt) => {
    if (spin && group.current) group.current.rotation.y += Math.min(dt, 0.05) * 0.13;
  });

  return (
    <group ref={group}>
      <primitive object={cloned} />
    </group>
  );
}

function PlannedGhost({ floors, floorHeightM }: { floors: number; floorHeightM: number }) {
  const h = floors * floorHeightM;
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(24.8, h, 16.8)), [h]);
  return (
    <mesh position={[0, 0.8 + h / 2, 0]} renderOrder={2}>
      <boxGeometry args={[24.8, h, 16.8]} />
      <meshStandardMaterial color="#0A8FA3" transparent opacity={0.14} depthWrite={false} />
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#0A8FA3" />
      </lineSegments>
    </mesh>
  );
}

/* ---------------------------------------------------------------- markers */

const MarkerPin = memo(function MarkerPin({
  marker,
  selected,
  reduced,
  occluders,
  onSelect,
}: {
  marker: TowerMarker;
  selected: boolean;
  reduced: boolean;
  occluders?: React.RefObject<THREE.Object3D>[];
  onSelect?: (id: string) => void;
}) {
  // Pins behind the tower dim instead of vanishing, so they stay reachable.
  const [hidden, setHidden] = useState(false);
  // Scale with distance like distanceFactor, but clamped so a close-up pin
  // never swallows the view and a far one stays a usable touch target.
  const scaler = useRef<HTMLDivElement>(null);
  const world = useMemo(() => new THREE.Vector3(...marker.position), [marker.position]);
  useFrame(({ camera }) => {
    const el = scaler.current;
    if (!el) return;
    const s = THREE.MathUtils.clamp(95 / camera.position.distanceTo(world), 0.72, 1.2);
    el.style.transform = `scale(${s.toFixed(3)})`;
  });
  return (
    <Html
      position={marker.position}
      center
      zIndexRange={[30, 10]}
      occlude={occluders}
      onOcclude={setHidden}
      style={{ transition: "opacity 200ms", opacity: hidden && !selected ? 0.4 : 1 }}
    >
      <div ref={scaler} style={{ transformOrigin: "50% 50%" }}>
        <MarkerButton id={marker.id} label={marker.label} severity={marker.severity} kind={marker.kind} selected={selected} pulse={!reduced} onSelect={onSelect} />
      </div>
    </Html>
  );
});

/* ------------------------------------------------------------ camera rig */

type V3 = [number, number, number];
interface RigApi {
  flyTo: (pos: V3, target: V3) => void;
  reset: () => void;
}

function defaultCameraFor(p: V3): V3 {
  // Back out along the horizontal direction from the tower axis, and up.
  const d = new THREE.Vector3(p[0], 0, p[2]);
  if (d.lengthSq() < 1) d.set(1, 0, 1);
  d.normalize();
  return [p[0] + d.x * 34 + 8, p[1] + 14, p[2] + d.z * 34 + 8];
}

/**
 * Smoothly moves the camera + orbit target toward a goal (critically damped
 * lerp in useFrame, instant with reduced motion). Any user drag cancels it.
 */
function CameraRig({
  apiRef,
  reduced,
  home,
  panBox,
  onDone,
}: {
  apiRef: MutableRefObject<RigApi | null>;
  reduced: boolean;
  home: { pos: V3; target: V3 } | null;
  panBox?: THREE.Box3;
  onDone?: () => void;
}) {
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  const apply = useCallback(
    (pos: V3, target: V3) => {
      if (!controls) return;
      if (reduced) {
        camera.position.set(...pos);
        controls.target.set(...target);
        controls.update();
        invalidate();
        return;
      }
      goal.current = { pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target) };
      invalidate();
    },
    [controls, camera, reduced, invalidate],
  );

  useEffect(() => {
    apiRef.current = {
      flyTo: apply,
      reset: () => home && apply(home.pos, home.target),
    };
  }, [apiRef, apply, home]);

  // Cancel an in-flight animation when the user grabs the camera, and keep
  // panning inside the site.
  useEffect(() => {
    if (!controls) return;
    const start = () => {
      if (goal.current) {
        goal.current = null;
        onDone?.();
      }
    };
    const change = () => {
      if (panBox && !goal.current) {
        const t = controls.target;
        const c = t.clone().clamp(panBox.min, panBox.max);
        if (!c.equals(t)) {
          const delta = c.clone().sub(t);
          t.copy(c);
          camera.position.add(delta);
        }
      }
    };
    controls.addEventListener("start", start);
    controls.addEventListener("change", change);
    return () => {
      controls.removeEventListener("start", start);
      controls.removeEventListener("change", change);
    };
  }, [controls, camera, panBox, onDone]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 4.2);
    camera.position.lerp(g.pos, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (camera.position.distanceTo(g.pos) < 0.05 && controls.target.distanceTo(g.target) < 0.05) {
      goal.current = null;
      onDone?.();
    } else {
      invalidate();
    }
  });
  return null;
}

/* Registers a reset for Bounds-framed variants (viewer). */
function BoundsReset({ apiRef }: { apiRef: MutableRefObject<(() => void) | null> }) {
  const bounds = useBounds();
  useEffect(() => {
    apiRef.current = () => bounds.refresh().clip().fit();
  }, [apiRef, bounds]);
  return null;
}

const Handle = forwardRef<TowerModelHandle, { effectsOn: boolean; resetRef: MutableRefObject<() => void> }>(function Handle({ effectsOn, resetRef }, ref) {
  const { gl, scene, camera } = useThree();
  useImperativeHandle(ref, () => ({
    capture: () => {
      // With post-processing the last composited frame is in the preserved
      // drawing buffer; a plain render would skip AO and tone mapping.
      if (!effectsOn) gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    },
    resetView: () => resetRef.current(),
  }));
  return null;
});

/* Effects need a decent GPU/CPU and are skipped for reduced motion. */
function useEffectsCapable(reduced: boolean) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(!reduced && (navigator.hardwareConcurrency ?? 0) >= 4);
  }, [reduced]);
  return ok;
}

function Effects({ bloom }: { bloom: boolean }) {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={2.2} distanceFalloff={1.2} intensity={2.4} quality="medium" halfRes />
      {bloom && <Bloom intensity={0.25} luminanceThreshold={0.92} mipmapBlur />}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
      <Vignette offset={0.32} darkness={0.32} />
    </EffectComposer>
  );
}

export const TowerModel = forwardRef<TowerModelHandle, Props>(function TowerModel(
  {
    src,
    variant = "viewer",
    plannedFloors,
    floorsTotal = 16,
    floorHeightM = 3.2,
    sliceFloor,
    className,
    towerOnly,
    onLoaded,
    markers,
    selectedId,
    onSelect,
    onInteract,
    effects,
    bloom = false,
  },
  ref,
) {
  const reduced = usePrefersReducedMotion();
  const hero = variant === "hero";
  const explorer = variant === "explorer";
  const capable = useEffectsCapable(reduced);
  const effectsOn = !hero && (effects ?? capable);

  const modelRef = useRef<THREE.Object3D | null>(null);
  const occluderRef = useRef<THREE.Group>(null) as React.RefObject<THREE.Group>;
  const rigRef = useRef<RigApi | null>(null);
  const boundsResetRef = useRef<(() => void) | null>(null);
  const resetRef = useRef<() => void>(() => {
    if (explorer) rigRef.current?.reset();
    else boundsResetRef.current?.();
  });

  // First interaction: stops the explorer's auto-rotate and fades the hint.
  const [interacted, setInteracted] = useState(false);
  const interactedRef = useRef(false);
  const interact = useCallback(() => {
    if (interactedRef.current) return;
    interactedRef.current = true;
    setInteracted(true);
    onInteract?.();
  }, [onInteract]);
  const [flying, setFlying] = useState(false);
  const stopFlying = useCallback(() => setFlying(false), []);
  const autoRotate = explorer && !reduced && !interacted && !selectedId;

  // Explorer framing: fixed, sized to the full-height tower, so swapping
  // flights never jumps the camera.
  const H = floorsTotal * floorHeightM + 0.8;
  const home = useMemo(() => {
    const target: V3 = [0, H * 0.4, 0];
    const dist = Math.min(150, Math.max(70, H * 2.05));
    const dir = new THREE.Vector3(0.62, 0.42, 0.66).normalize().multiplyScalar(dist);
    return { pos: [dir.x, target[1] + dir.y, dir.z] as V3, target };
  }, [H]);
  const panBox = useMemo(() => new THREE.Box3(new THREE.Vector3(-22, 0, -18), new THREE.Vector3(22, H + 4, 18)), [H]);

  // Fly to the selected marker.
  const markerById = useMemo(() => new Map((markers ?? []).map((m) => [m.id, m])), [markers]);
  const selected = selectedId ? markerById.get(selectedId) : undefined;
  const selKey = selected ? `${selected.id}:${selected.position.join(",")}` : null;
  useEffect(() => {
    if (!selected) return;
    setFlying(!reduced);
    rigRef.current?.flyTo(selected.camera ?? defaultCameraFor(selected.position), selected.position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  const withMarkers = !hero && markers && markers.length > 0;
  const lightTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, H * 0.35, 0);
    return o;
  }, [H]);
  const showContact = hero || towerOnly;

  return (
    <div
      className={className}
      onPointerDownCapture={explorer ? interact : undefined}
      onWheelCapture={explorer ? interact : undefined}
    >
      <Canvas
        shadows="percentage"
        dpr={explorer ? [1, 1.75] : [1, 2]}
        frameloop={explorer ? (autoRotate || flying ? "always" : "demand") : "always"}
        camera={{ position: hero ? [55, 38, 55] : explorer ? home.pos : [70, 55, 70], fov: 35, near: 0.5, far: 1200 }}
        gl={{
          preserveDrawingBuffer: !hero,
          antialias: !effectsOn,
          alpha: !effectsOn,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        {effectsOn && <color attach="background" args={["#E4E8EA"]} />}
        {effectsOn && <fog attach="fog" args={["#E4E8EA", 220, 520]} />}
        <hemisphereLight args={["#dfe9f0", "#8c8173", 0.45]} />
        <primitive object={lightTarget} />
        <directionalLight
          position={[45, 85, 38]}
          intensity={2.6}
          color="#fff4e6"
          target={lightTarget}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.04}
          shadow-radius={4}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={50}
          shadow-camera-bottom={-45}
          shadow-camera-near={10}
          shadow-camera-far={220}
        />
        <Suspense fallback={null}>
          <SceneEnvironment sky={!hero} />
          {/* aerial perspective: distant ground fades into haze instead of ending at a hard, tiled edge */}
          {!hero && <fog attach="fog" args={["#c9d3d9", 140, 520]} />}
          {explorer ? (
            <>
              <group ref={occluderRef}>
                <Model src={src} sliceFloor={sliceFloor} floorHeightM={floorHeightM} towerOnly={towerOnly} spin={false} onLoaded={onLoaded} modelRef={modelRef} />
              </group>
              {plannedFloors != null && <PlannedGhost floors={plannedFloors} floorHeightM={floorHeightM} />}
            </>
          ) : (
            <Bounds fit clip observe margin={hero ? 0.85 : 1.2}>
              <group ref={occluderRef}>
                <Model src={src} sliceFloor={sliceFloor} floorHeightM={floorHeightM} towerOnly={towerOnly ?? hero} spin={hero && !reduced} onLoaded={onLoaded} modelRef={modelRef} />
              </group>
              {plannedFloors != null && !hero && <PlannedGhost floors={plannedFloors} floorHeightM={floorHeightM} />}
              {!hero && <BoundsReset apiRef={boundsResetRef} />}
            </Bounds>
          )}
          {showContact && <ContactShadows position={[0, 0.02, 0]} opacity={0.35} scale={80} blur={2.6} far={40} resolution={512} frames={hero ? Infinity : 1} />}
          {withMarkers &&
            markers!.map((m) => (
              <MarkerPin key={m.id} marker={m} selected={m.id === selectedId} reduced={reduced} occluders={[occluderRef as React.RefObject<THREE.Object3D>]} onSelect={onSelect} />
            ))}
        </Suspense>
        {explorer && (
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={25}
            maxDistance={180}
            maxPolarAngle={Math.PI / 2 - 0.06}
            minPolarAngle={0.12}
            panSpeed={0.6}
            screenSpacePanning={false}
            autoRotate={autoRotate}
            autoRotateSpeed={0.45}
            target={home.target}
          />
        )}
        {variant === "viewer" && <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.05} />}
        {!hero && (
          <CameraRig
            apiRef={rigRef}
            reduced={reduced}
            home={explorer ? home : null}
            panBox={explorer ? panBox : undefined}
            onDone={stopFlying}
          />
        )}
        {!hero && <Handle ref={ref} effectsOn={effectsOn} resetRef={resetRef} />}
        {effectsOn && <Effects bloom={bloom} />}
      </Canvas>
    </div>
  );
});

export default TowerModel;
