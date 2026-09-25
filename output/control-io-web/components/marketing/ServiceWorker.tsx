"use client";

import { useEffect } from "react";
import { STATIC_SITE } from "@/lib/siteMode";

/** Registers public/sw.js on the static site (GitHub Pages) once the page has loaded; the server app has real cache headers. */
export function ServiceWorker() {
  useEffect(() => {
    if (!STATIC_SITE || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
