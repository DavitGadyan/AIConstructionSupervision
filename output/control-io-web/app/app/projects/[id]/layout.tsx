import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/Shell";
import { HttpError, projectForSession, requireSession } from "@/lib/server/auth";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const s = await requireSession();
  const { id } = await params;
  // Read access: own org (any role) or an org the project is shared with.
  const project = await projectForSession(id, s, "read").catch((e) => {
    if (e instanceof HttpError) return null;
    throw e;
  });
  if (!project) notFound();
  return <AppShell user={s} projectId={id}>{children}</AppShell>;
}
