"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { clearAdminSession } from "../lib/session";
import { useAdminSession } from "../lib/useAdminSession";
import { AdminLogin } from "./AdminLogin";
import {
  IconAward,
  IconDoc,
  IconPulse,
  IconSeason,
  IconSwords,
  IconUsers,
} from "./atoms";

const NAV: { label: string; href: string; icon: ReactNode }[] = [
  { label: "Overview", href: "/", icon: <IconPulse /> },
  { label: "Users", href: "/users", icon: <IconUsers /> },
  { label: "Battles", href: "/battles", icon: <IconSwords /> },
  { label: "Problems", href: "/problems", icon: <IconDoc /> },
  { label: "Badges", href: "/badges", icon: <IconAward /> },
  { label: "Seasons", href: "/seasons", icon: <IconSeason /> },
];

/**
 * The console chrome, and the gate in front of it.
 *
 * Every page renders inside this, so an unauthenticated visitor sees the login
 * form and nothing else — there is no page that forgets to check. The real
 * enforcement is server-side (`requireAdmin` re-reads the role on every
 * request); this only decides what to draw.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { session, loaded, refresh } = useAdminSession();
  const pathname = usePathname();
  const router = useRouter();

  if (!loaded) {
    return (
      <div className="min-h-dvh" style={{ background: "var(--color-void)" }} />
    );
  }

  if (!session) {
    return <AdminLogin onReady={refresh} />;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          borderColor: "var(--color-line)",
          background: "color-mix(in srgb, var(--color-void) 82%, transparent)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-5 py-3 sm:px-7">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Wordmark />
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-item"
                  data-active={active}
                >
                  <span style={{ opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p
                className="font-mono text-[0.72rem] leading-tight"
                style={{ color: "var(--color-ink-dim)" }}
              >
                {session.username}
              </p>
              <p
                className="font-mono text-[0.62rem] leading-tight"
                style={{ color: "var(--color-ink-ghost)" }}
              >
                {session.email}
              </p>
            </div>
            <button
              className="btn btn-ghost px-3! py-1.5! text-[0.68rem]!"
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

        {/* The nav collapses to a scrollable strip below md rather than into a
            hamburger — four items is not enough to justify hiding them. */}
        <nav
          className="flex gap-1 overflow-x-auto border-t px-5 py-2 md:hidden"
          style={{ borderColor: "var(--color-line)" }}
        >
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="nav-item shrink-0"
                data-active={active}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-7">
        {children}
      </main>

      <footer
        className="border-t px-5 py-4 sm:px-7"
        style={{ borderColor: "var(--color-line)" }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <Wordmark small />
          <p
            className="font-mono text-[0.62rem]"
            style={{ color: "var(--color-ink-ghost)" }}
          >
            Internal tooling · not for public access
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * The console's mark.
 *
 * Flat --color-accent, which is a light grey in the console and the player
 * app's orange under .auth-theme — so the same component reads as CombatX on
 * the sign-in door and as neutral chrome everywhere behind it.
 */
export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        className="font-mono font-bold tracking-tight"
        style={{
          fontSize: small ? "0.78rem" : "0.98rem",
          color: "var(--color-accent)",
        }}
      >
        COMBATX
      </span>
      <span
        className="label"
        style={{ letterSpacing: "0.2em", fontSize: small ? "0.56rem" : "0.6rem" }}
      >
        Admin
      </span>
    </span>
  );
}
