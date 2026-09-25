import { redirect } from "next/navigation";
import { readableProjectIds, requireSession } from "@/lib/server/auth";

export default async function AppHome() {
  const s = await requireSession();
  // Own projects and projects shared with the caller's org.
  const projects = await readableProjectIds(s);
  redirect(projects.length === 1 ? `/app/projects/${projects[0]}` : "/app/projects");
}
