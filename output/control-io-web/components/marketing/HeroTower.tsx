"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { PHOTOREAL_M8 } from "@/lib/content/demoDefects";

/**
 * The ORDI centre object: the drone-reconstructed tower on a slow turntable.
 * A transparent poster render holds its place while WebGL loads, and stays if
 * the device has no WebGL - the hero is never an empty hole.
 */
const TowerModel = dynamic(() => import("@/components/three/TowerModel"), { ssr: false, loading: () => null });

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

export function HeroTower({ className, label, exploreLabel = "Explore the model" }: { className?: string; label: string; exploreLabel?: string }) {
  const [webgl, setWebgl] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setWebgl(hasWebGL()), []);
  const onLoaded = useCallback(() => setTimeout(() => setReady(true), 250), []);
  return (
    <div className={className}>
      <div className="relative size-full" role="img" aria-label={label}>
        <Image
          src="/samples/tower-m8-poster.png"
          alt=""
          width={514}
          height={826}
          priority
          sizes="(min-width:1280px) 40vw, 90vw"
          className={`absolute inset-0 m-auto h-[88%] w-auto object-contain transition-opacity duration-500 ${ready ? "opacity-0" : "opacity-100"}`}
        />
        {webgl && <TowerModel src={PHOTOREAL_M8} variant="hero" className="relative size-full" onLoaded={onLoaded} />}
      </div>
      {/* The hero object is decorative (pointer-events-none); this is the way in. */}
      <a
        href="#explorer"
        className="pointer-events-auto absolute bottom-[2%] left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/70 px-4 py-2 text-[14px] font-medium text-ink shadow-[var(--shadow-inner)] backdrop-blur transition hover:bg-white xl:bottom-[9%]"
      >
        {exploreLabel}
        <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
          <path d="M8 3v9.5M4 8.5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </div>
  );
}
