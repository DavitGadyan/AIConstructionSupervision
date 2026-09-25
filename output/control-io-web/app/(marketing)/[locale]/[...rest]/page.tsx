import { notFound } from "next/navigation";

// Overrides the layout's dynamicParams=false so unknown paths reach this page
// and 404 inside the localized layout instead of Next's bare fallback.
export const dynamicParams = true;

/** Any unknown path under a locale renders the localized 404 inside the marketing layout. */
export default function CatchAll() {
  notFound();
}
