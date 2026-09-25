import type { Metadata } from "next";
import "../globals.css";
import { RootDocument } from "@/components/RootDocument";
import { baseMetadata, baseViewport } from "@/lib/rootMetadata";

export const metadata: Metadata = { ...baseMetadata, title: { default: "Sign in", template: "%s — control.io" } };
export const viewport = baseViewport;

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument lang="en">{children}</RootDocument>;
}
