import type { IndustryIcon } from "@/lib/content/industries";

const paths: Record<IndustryIcon | "play" | "check" | "chevron" | "menu" | "close" | "arrow-left" | "arrow-right" | "mail" | "phone" | "pin" | "clock", React.ReactNode> = {
  building: (<><path d="M4 21V5l8-3v19" /><path d="M12 8l8 3v10" /><path d="M2 21h20M7 8h2M7 12h2M7 16h2M15 14h2M15 18h2" /></>),
  bank: (<><path d="M3 9l9-5 9 5" /><path d="M4 9h16M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18M3 18h18" /></>),
  "shield-check": (<><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>),
  umbrella: (<><path d="M3 12a9 9 0 0118 0z" /><path d="M12 12v7a2 2 0 01-4 0" /><path d="M12 3v0" /></>),
  "hard-hat": (<><path d="M3 18h18v-2a9 9 0 00-18 0z" /><path d="M10 7V5h4v2M9.5 16V8.5M14.5 16V8.5" /></>),
  sun: (<><rect x="3" y="11" width="18" height="9" rx="1" /><path d="M3 15.5h18M9 11v9M15 11v9" /><circle cx="12" cy="5" r="2" /><path d="M12 1.5v.5M16 5h.5M7.5 5H8" /></>),
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5L12 13l8.5-6.5" /></>),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z" />,
  pin: (<><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
};

export type IconName = keyof typeof paths;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {paths[name]}
    </svg>
  );
}
