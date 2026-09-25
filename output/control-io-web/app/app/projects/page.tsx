import Link from "next/link";
import { AppShell } from "@/components/app/Shell";
import { GlassCard, Pill, severityTone } from "@/components/ui/primitives";
import { requireSession } from "@/lib/server/auth";
import { listProjects } from "@/lib/server/queries";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requireSession();
  const { q } = await searchParams;
  const all = await listProjects(s);
  const projects = q ? all.filter((p) => `${p.name} ${p.address} ${p.developer}`.toLowerCase().includes(q.toLowerCase())) : all;
  return (
    <AppShell user={s}>
      <h1 className="display-xl px-2 text-[44px] text-ink md:text-[72px]">Projects</h1>
      <p className="mt-3 px-2 text-muted">{projects.length} site{projects.length === 1 ? "" : "s"} under supervision</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <GlassCard key={p.id} as="article" title={p.name} subtitle={p.address} href={`/app/projects/${p.id}`}>
            <div className="inner overflow-hidden p-0">
              {p.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverUrl} alt={`Latest drone shot of ${p.name}`} className="aspect-[16/10] w-full object-cover" />
              )}
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-[13px] text-muted">Schedule variance</p>
                  <p className="font-display text-[28px] font-bold tabular">{p.daysBehind > 0 ? `−${p.daysBehind}d` : `+${-p.daysBehind}d`}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Pill tone={severityTone(p.status)}>{p.status}</Pill>
                  {p.shared && <Pill tone="light">Shared{p.access === "order" ? " · can order" : ""}</Pill>}
                </div>
              </div>
            </div>
          </GlassCard>
        ))}
        {!projects.length && <p className="text-muted">No projects match “{q}”. <Link className="underline" href="/app/projects">Clear search</Link></p>}
      </div>
    </AppShell>
  );
}
