import type { Metadata, Viewport } from "next";
import { site } from "@/lib/tokens";

/** Metadata every root layout starts from (metadataBase, app name, robots). */
export const baseMetadata: Metadata = {
  metadataBase: new URL(site.url),
  applicationName: "control.io",
  robots: { index: true, follow: true },
};

export const baseViewport: Viewport = {
  themeColor: "#E4E8EA",
  colorScheme: "light",
};
