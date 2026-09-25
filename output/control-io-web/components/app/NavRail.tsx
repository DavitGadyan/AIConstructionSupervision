"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/primitives";
import { DroneIcon } from "./OrderInspectionButton";

const I = {
  home: <path d="M4 9.5L10 5l6 4.5V16H4V9.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />,
  flights: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="4" width="5" height="5" rx="1.4" /><rect x="11" y="4" width="5" height="5" rx="1.4" /><rect x="4" y="11" width="5" height="5" rx="1.4" /><rect x="11" y="11" width="5" height="5" rx="1.4" />
    </g>
  ),
  model: <path d="M10 3.5l6 3.3v6.4l-6 3.3-6-3.3V6.8l6-3.3zM4 6.8l6 3.4 6-3.4M10 10.2v6.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />,
  docs: <path d="M6 3.5h5.5L15 7v9.5H6V3.5zM11 3.5V7h4M8 10.5h5M8 13h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />,
  live: <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="10" cy="10" r="2" /><path d="M6.3 6.3a5.2 5.2 0 000 7.4M13.7 6.3a5.2 5.2 0 010 7.4" /></g>,
  reports: <path d="M5 16V4M5 16h11M8 13V9M11 13V6M14 13v-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
};

export function NavRail({ projectId, orderActive = false }: { projectId: string; orderActive?: boolean }) {
  const path = usePathname();
  const base = `/app/projects/${projectId}`;
  // ORDI: four primary icons centred on the rail, utility icons pinned to the bottom.
  // Seven in total: size-11 on phones so they fit a 390 px bottom bar.
  const primary = [
    { href: base, label: "Dashboard", icon: I.home, exact: true },
    { href: `${base}/flights`, label: "Flights & shots", icon: I.flights },
    { href: `${base}/model`, label: "3D model", icon: I.model },
    { href: `${base}/reports`, label: "Reports", icon: I.reports },
  ];
  const utility: { href: string; label: string; icon: React.ReactNode; exact?: boolean; badge?: boolean }[] = [
    { href: `${base}/orders`, label: orderActive ? "Orders (inspection in progress)" : "Orders", icon: "drone", badge: orderActive },
    { href: `${base}/documents`, label: "Documents", icon: I.docs },
    { href: `${base}/live`, label: "Live", icon: I.live },
  ];
  return (
    <nav
      aria-label="Project"
      className="glass fixed inset-x-3 bottom-3 z-30 flex justify-between gap-1 rounded-[22px] p-2 md:sticky md:inset-auto md:top-6 md:h-[calc(100dvh-8.5rem)] md:flex-col md:justify-start md:gap-3 md:self-start md:rounded-[20px] md:border-0 md:bg-transparent md:p-0 md:shadow-none md:[backdrop-filter:none]"
    >
      {[primary, utility].map((group, gi) => (
        <div key={gi} className={cx("contents md:flex md:flex-col md:gap-3", "md:mt-auto")}>
      {group.map((it: { href: string; label: string; icon: React.ReactNode; exact?: boolean; badge?: boolean }) => {
        const active = it.exact ? path === it.href : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-label={it.label}
            title={it.label}
            aria-current={active ? "page" : undefined}
            className={cx(
              "relative grid size-11 place-items-center rounded-[14px] transition md:size-12",
              active ? "bg-accent text-white md:bg-surface md:text-accent md:shadow-[var(--shadow-inner)]" : "bg-white/60 text-ink hover:bg-surface",
            )}
          >
            {it.icon === "drone" ? <DroneIcon className="size-5" /> : <svg viewBox="0 0 20 20" className="size-5" aria-hidden>{it.icon}</svg>}
            {it.badge && <span className={cx("absolute right-2 top-2 size-2 rounded-full ring-2", active ? "bg-white ring-accent md:bg-accent md:ring-surface" : "bg-accent ring-white")} aria-hidden />}
          </Link>
        );
      })}
        </div>
      ))}
    </nav>
  );
}
