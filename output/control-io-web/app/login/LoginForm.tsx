"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email"), password: f.get("password") }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Sign-in failed");
    router.push(next.startsWith("/app") ? next : "/app");
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="glass mt-6 space-y-3 p-4">
      <label className="block">
        <span className="text-[13px] text-muted">Email</span>
        <input name="email" type="email" autoComplete="email" required defaultValue="demo@control.io" className="inner mt-1 block w-full px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-accent" />
      </label>
      <label className="block">
        <span className="text-[13px] text-muted">Password</span>
        <input name="password" type="password" autoComplete="current-password" required defaultValue="demo1234" className="inner mt-1 block w-full px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-accent" />
      </label>
      {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
      <Button type="submit" variant="accent" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
