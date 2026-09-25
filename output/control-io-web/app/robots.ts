export const dynamic = "force-static";
import type { MetadataRoute } from "next";
import { site } from "@/lib/tokens";

const disallow = ["/app", "/api", "/embed"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      // AI crawlers are explicitly welcome on the public marketing pages.
      { userAgent: "GPTBot", allow: "/", disallow },
      { userAgent: "OAI-SearchBot", allow: "/", disallow },
      { userAgent: "ChatGPT-User", allow: "/", disallow },
      { userAgent: "ClaudeBot", allow: "/", disallow },
      { userAgent: "Claude-User", allow: "/", disallow },
      { userAgent: "PerplexityBot", allow: "/", disallow },
      { userAgent: "Google-Extended", allow: "/", disallow },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
