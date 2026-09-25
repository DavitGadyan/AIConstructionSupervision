import type { Metadata } from "next";
import "../globals.css";
import { RootDocument } from "@/components/RootDocument";
import { baseMetadata, baseViewport } from "@/lib/rootMetadata";

export const metadata: Metadata = { ...baseMetadata, title: "control.io", robots: { index: false, follow: false } };
export const viewport = baseViewport;

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument lang="en">{children}</RootDocument>;
}
