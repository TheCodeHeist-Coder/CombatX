"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAdminSession } from "../lib/session";
import { useAdminSession } from "../lib/useAdminSession";
import { AdminLogin } from "./AdminLogin";

const NAV = [
  { label: "Overview", href: "/" },
  { label: "Users", href: "/users" },
  { label: "Battles", href: "/battles" },
  { label: "Problems", href: "/problems" },
] as const;

/**
 * The console chrome, and the gate in front of it.
 *
 * Every page renders inside this, so an unauthenticated visitor sees the login
 * form and nothing else — there is no page that forgets to check. The real
 * enforcement is server-side (`requireAdmin` re-reads the role on every
 * request); this only decides what to draw.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { session, loaded, refresh } = useAdminSession();
  const pathname = usePathname();
  const router = useRouter();

  if (!loaded) {
    return <div className="min-h-dvh" style={{ background: "var(--color-void)" }} />;
  }

  if (!session) {
    return <AdminLogin onReady={refresh} />;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="sticky top-0 z-20 border-b"
        style={{
          borderColor: "var(--color-line)",
          background: "color-mix(in srgb, var(--color-void) 88%, transparent)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center gap-6 px-5 py-3 sm:px-7">
          <Link href="/" className="flex items-baseline gap-2">
            <span
              className="font-mono text-[0.95rem] font-bold tracking-tight"
              style={{ color: "var(--color-primary)" }}
            >
              COMBATX
            </span>
            <span className="label" style={{ letterSpacing: "0.18em" }}>
              Admin
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[6px] px-3 py-1.5 font-mono text-[0.8rem] transition-colors"
                  style={{
                    color: active
                      ? "var(--color-accent)"
                      : "var(--color-ink-dim)",
                    background: active ? "var(--color-surface-2)" : undefined,
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span
              className="hidden font-mono text-[0.72rem] sm:inline"
              style={{ color: "var(--color-ink-faint)" }}
            >
              {session.email}
            </span>
            <button
              className="btn btn-ghost px-3! py-1.5! text-[0.7rem]!"
              onClick={() => {
                clearAdminSession();
                refresh();
                router.push("/");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-7">
        {children}
      </main>
    </div>
  );
}
