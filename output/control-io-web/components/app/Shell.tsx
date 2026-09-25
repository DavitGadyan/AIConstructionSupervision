import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/primitives";
import type { Session } from "@/lib/server/auth";
import { NavRail } from "./NavRail";
import { OrderInspectionButton } from "./OrderInspectionButton";
import { orderContext } from "./orderContext";

/**
 * ORDI dashboard chrome: top bar (search, live, Order inspection, bell, avatar,
 * accent Menu) + floating icon rail. Inside a project the top bar carries the
 * order call to action (or "Track INS-…" while an order is active).
 */
export async function AppShell({
  user,
  projectId,
  children,
}: {
  user: { name: string } & Partial<Pick<Session, "orgId" | "role">>;
  projectId?: string;
  children: ReactNode;
}) {
  const initials = user.name.split(" ").map((p) => p[0]).join("").slice(0, 2);
  // Never let the order lookup take the chrome down with it.
  const ctx = projectId && user.orgId && user.role ? await orderContext(projectId, { orgId: user.orgId, role: user.role }).catch(() => null) : null;
  const active = ctx?.active ? { id: ctx.active.id, number: ctx.active.number, status: ctx.active.status } : null;
  const ordersHref = projectId ? `/app/projects/${projectId}/orders` : null;
  return (
    <div className="min-h-dvh bg-page p-2 md:p-4">
      <div className="stage min-h-[calc(100dvh-16px)] md:min-h-[calc(100dvh-32px)]">
        <header className="relative z-20 flex items-center gap-3 px-4 pt-4 md:gap-4 md:px-7 md:pt-6">
          <Link href="/app" aria-label="control.io projects" className="shrink-0"><Logo className="text-[22px] md:text-[26px]" /></Link>
          <form action="/app/projects" className="ml-2 hidden flex-1 items-center gap-2 md:flex md:max-w-[320px]">
            <label className="glass flex h-12 flex-1 items-center gap-2 rounded-[14px] px-4 text-[15px] text-muted shadow-none">
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              <input name="q" placeholder="Search projects" className="w-full bg-transparent text-ink outline-none placeholder:text-muted" />
            </label>
          </form>
          {projectId && (
            <Link href={`/app/projects/${projectId}/live`} aria-label="Live feed" className="hidden size-12 place-items-center rounded-[14px] bg-surface shadow-[var(--shadow-inner)] md:grid">
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden><path d="M4 8v4M7 5v10M10 7v6M13 4v12M16 8v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </Link>
          )}
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            {projectId && ctx && (active || ctx.canOrder) && (
              <div className="hidden md:flex">
                <OrderInspectionButton projectId={projectId} active={active} canOrder={ctx.canOrder} variant="bar" />
              </div>
            )}
            <Link href={projectId ? `/app/projects/${projectId}/live` : "/app"} aria-label="Notifications" className="relative grid size-11 place-items-center rounded-[14px] bg-surface shadow-[var(--shadow-inner)] md:size-12">
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden><path d="M5 14h10l-1.2-2V9a3.8 3.8 0 00-7.6 0v3L5 14zM8.5 16.5a1.6 1.6 0 003 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
              <span className="absolute right-3 top-3 size-2 rounded-full bg-accent" />
            </Link>
            <span className="hidden size-11 place-items-center rounded-[14px] bg-accent2 font-display text-[15px] font-semibold text-white sm:grid md:size-12" title={user.name} aria-label={`Signed in as ${user.name}`}>
              {initials}
            </span>
            <details className="relative">
              <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-[14px] bg-accent px-4 text-[15px] font-medium text-white md:h-12 md:px-5">
                Menu
                <svg viewBox="0 0 20 20" className="size-4" aria-hidden><path d="M4 7h12M4 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </summary>
              <div className="glass absolute right-0 top-14 z-30 w-56 p-2">
                <p className="truncate px-3 pb-2 pt-1 text-[13px] text-muted sm:hidden">Signed in as {user.name}</p>
                {ordersHref && active && (
                  <Link className="block rounded-[10px] px-3 py-2 font-medium text-accent hover:bg-white md:hidden" href={`${ordersHref}/${active.id}`}>Track {active.number}</Link>
                )}
                {ordersHref && !active && ctx?.canOrder && (
                  <Link className="block rounded-[10px] px-3 py-2 font-medium text-accent hover:bg-white md:hidden" href={`${ordersHref}#new-order`}>Order inspection</Link>
                )}
                <Link className="block rounded-[10px] px-3 py-2 hover:bg-white" href="/app/projects">All projects</Link>
                {ordersHref && <Link className="block rounded-[10px] px-3 py-2 hover:bg-white" href={ordersHref}>Orders</Link>}
                {projectId && <Link className="block rounded-[10px] px-3 py-2 hover:bg-white" href={`/app/projects/${projectId}/reports`}>Reports</Link>}
                <Link className="block rounded-[10px] px-3 py-2 hover:bg-white" href="/">Website</Link>
                <form action="/logout" method="post"><button className="w-full rounded-[10px] px-3 py-2 text-left hover:bg-white">Sign out</button></form>
              </div>
            </details>
          </div>
        </header>
        <div className="relative flex gap-4 px-3 pb-24 pt-4 md:px-5 md:pb-6">
          {projectId && <NavRail projectId={projectId} orderActive={!!active} />}
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
