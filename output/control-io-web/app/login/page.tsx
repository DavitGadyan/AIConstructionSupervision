import type { Metadata } from "next";
import { Logo } from "@/components/ui/primitives";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-page p-4">
      <div className="stage w-full max-w-[460px] p-6 md:p-8">
        <Logo />
        <h1 className="mt-8 font-display text-[40px] font-bold uppercase leading-[0.9] tracking-[-0.04em]">Sign in</h1>
        <p className="mt-2 text-muted">Supervise every floor from the air.</p>
        <LoginForm next={next ?? "/app"} />
        <p className="mt-6 text-[13px] text-muted">Demo account: <span className="text-ink">demo@control.io</span> / <span className="text-ink">demo1234</span></p>
      </div>
    </main>
  );
}
