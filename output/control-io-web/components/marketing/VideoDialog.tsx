"use client";

import { useRef, type ReactNode } from "react";

export interface VideoLabels {
  title: string;
  close: string;
}

/**
 * A link that opens the drone-flight clip in a native <dialog>. Without JS it stays a plain link
 * (href), so the page still leads somewhere useful. The video only loads when opened.
 */
export function VideoDialogTrigger({
  href,
  className,
  children,
  labels,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  labels: VideoLabels;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const open = (e: React.MouseEvent) => {
    if (!dialog.current?.showModal) return; // very old browser: follow the link
    e.preventDefault();
    dialog.current.showModal();
    video.current?.play().catch(() => {});
  };
  const close = () => {
    video.current?.pause();
    dialog.current?.close();
  };
  return (
    <>
      <a href={href} onClick={open} className={className}>
        {children}
      </a>
      <dialog
        ref={dialog}
        aria-label={labels.title}
        onClose={() => video.current?.pause()}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(1100px,94vw)] overflow-visible bg-transparent p-0 backdrop:bg-ink/70 backdrop:backdrop-blur-sm"
      >
        <div className="relative overflow-hidden rounded-[20px] bg-ink shadow-2xl">
          <video
            ref={video}
            className="block aspect-[3/2] w-full"
            poster="/images/marketing/drone-scan.webp"
            muted
            playsInline
            loop
            controls
            preload="none"
          >
            <source src="/videos/drone-orbit.webm" type="video/webm" />
            <source src="/videos/drone-orbit.mp4" type="video/mp4" />
          </video>
          <button
            type="button"
            onClick={close}
            aria-label={labels.close}
            className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white/85 text-ink backdrop-blur transition hover:bg-white"
          >
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className="mt-3 text-center text-[14px] text-white/85">{labels.title}</p>
      </dialog>
    </>
  );
}
