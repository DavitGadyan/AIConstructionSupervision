import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/primitives";

/**
 * Neutral phone frame around an app screenshot: ink bezel, a small camera
 * island and a rounded screen. Everything is sized in percentages of the
 * frame width, so the same markup works as a 220 px row item and a 300 px
 * hero frame. Corner radii are given as horizontal/vertical pairs that come
 * out circular at the 560:1212 screen ratio (390x844 @ ~1.44x).
 *
 * `src` is a static image import, never a URL string: the import gives a
 * content-hashed URL plus the intrinsic size, so a replaced screenshot can
 * never be served from a cache that still holds the previous frame.
 *
 * `children` render on top of the screen (e.g. a live status chip).
 */
export function PhoneMockup({
  src,
  alt,
  sizes,
  priority = false,
  className,
  children,
}: {
  src: StaticImageData;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx("relative rounded-[14.5%/6.9%] bg-ink p-[3.2%] shadow-[var(--shadow-card)]", className)}>
      <div className="relative overflow-hidden rounded-[11.5%/5.3%] bg-page">
        <Image
          src={src}
          alt={alt}
          sizes={sizes}
          priority={priority}
          className="block h-auto w-full"
        />
        {/* Camera island: decorative, sits over the status bar like on a real device. */}
        <span aria-hidden className="absolute left-1/2 top-[1.6%] h-[2.6%] w-[27%] -translate-x-1/2 rounded-full bg-ink" />
      </div>
      {children}
    </div>
  );
}
