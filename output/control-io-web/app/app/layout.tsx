import type { Metadata } from "next";
import "../globals.css";
import { RootDocument } from "@/components/RootDocument";
import { baseMetadata, baseViewport } from "@/lib/rootMetadata";

// Root layout for the signed-in product (the marketing site has its own per-locale root layout).
export const metadata: Metadata = {
  ...baseMetadata,
  title: { default: "Dashboard", template: "%s — control.io" },
  robots: { index: false, follow: false },
};
export const viewport = baseViewport;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument lang="en">{children}</RootDocument>;
}
