"use client";

import Image from "next/image";
import { useState } from "react";

/** 16:10 evidence close-up; a neutral block if the file is missing or fails. */
export function EvidenceImage({
  src,
  alt,
  labels = { missing: "Evidence image not available yet", caption: "AI-generated sample imagery, not a real site photo." },
}: {
  src: string;
  alt: string;
  labels?: { missing: string; caption: string };
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const broken = failed === src;
  return (
    <figure className="m-0">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-inner)] bg-accent2-soft">
        {broken ? (
          <div role="img" aria-label={alt} className="grid size-full place-items-center text-center text-[13px] text-muted">
            <span className="flex flex-col items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 16l5-4.5 4 3.5 3-2.5 6 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="16" cy="9.5" r="1.5" fill="currentColor" />
              </svg>
              {labels.missing}
            </span>
          </div>
        ) : (
          <Image
            key={src}
            src={src}
            alt={alt}
            fill
            sizes="(min-width:1024px) 420px, 92vw"
            className="object-cover"
            onError={() => setFailed(src)}
          />
        )}
      </div>
      <figcaption className="mt-2 text-[12px] text-muted">{labels.caption}</figcaption>
    </figure>
  );
}
