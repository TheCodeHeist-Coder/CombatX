"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { rankFor } from "@repo/game";
import { Logo } from "./Logo";
import type { Session } from "../lib/session";

/**
 * The persistent application chrome: a top command bar plus an optional left
 * rail. Screens render inside it.
 *
 * Some destinations are not built yet (Intel, Archive, Armory, …). Rather than
 * hide them, they render as visibly locked with a `SOON` tag — a nav item that
 * silently does nothing is worse than one that says so.
 */

interface NavItem {
  label: string;
  href: string;
  ready: boolean;
}

const TOP_NAV: NavItem[] = [
  { label: "Lobby", href: "/", ready: true },
  { label: "Arena", href: "/arena", ready: false },
  { label: "Intel", href: "/intel", ready: false },
  { label: "Archive", href: "/archive", ready: false },
];

const RAIL_NAV: (NavItem & { icon: ReactNode })[] = [
  { label: "Mission Control", href: "/", ready: true, icon: <IconTerminal /> },
  { label: "Tactical Feed", href: "/feed", ready: false, icon: <IconChart /> },
  { label: "Armory", href: "/armory", ready: false, icon: <IconShield /> },
  { label: "Rankings", href: "/rankings", ready: false, icon: <IconMedal /> },
  { label: "Settings", href: "/settings", ready: false, icon: <IconGear /> },
];

export function AppShell({
  session,
  children,
  rail = false,
  right,
}: {
  session?: Session | null;
  children: ReactNode;
  /** Show the left navigation rail (dashboard-style screens). */
  rail?: boolean;
  right?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <CommandBar session={session} right={right} />
      <div className="flex flex-1">
        {rail && <NavRail session={session} />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <SiteFooter />
    </div>
  );
}

function CommandBar({
  session,
  right,
}: {
  session?: Session | null;
  right?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-30 flex flex-wrap items-center gap-x-6 gap-y-3 border-b px-5 py-3 sm:px-7"
      style={{
        borderColor: "var(--color-line)",
        background: "color-mix(in srgb, var(--color-void) 92%, transparent)",
        backdropFilter: "blur(8px)",
      }}
    >
      <Link href="/" className="transition-opacity hover:opacity-75">
        <Logo />
      </Link>

      <nav className="flex items-center gap-1">
        {TOP_NAV.map((item) => (
          <NavLink key={item.label} item={item} active={pathname === item.href} />
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2.5">
        {right}
        {session && <IdentityChip session={session} />}
      </div>
    </header>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const base =
    "relative px-2.5 py-1.5 text-[0.82rem] font-medium transition-colors";

  if (!item.ready) {
    return (
      <span
        className={`${base} cursor-not-allowed`}
        style={{ color: "var(--color-ink-ghost)" }}
        title={`${item.label} — not built yet`}
      >
        {item.label}
        <sup
          className="ml-1 font-mono text-[0.5rem] tracking-wider"
          style={{ color: "var(--color-line-strong)" }}
        >
          SOON
        </sup>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={base}
      style={{ color: active ? "var(--color-accent)" : "var(--color-ink-dim)" }}
    >
      {item.label}
      {active && (
        <span
          className="absolute inset-x-2.5 -bottom-px h-0.5"
          style={{ background: "var(--color-accent)" }}
        />
      )}
    </Link>
  );
}

function IdentityChip({ session }: { session: Session }) {
  return (
    <span className="chip chip-good">
      <span
        className="ping-ring relative inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--color-good)", color: "var(--color-good)" }}
      />
      {session.displayName}
    </span>
  );
}

function NavRail({ session }: { session?: Session | null }) {
  const pathname = usePathname();

  return (
    <aside
      className="hidden w-60 shrink-0 flex-col border-r lg:flex"
      style={{ borderColor: "var(--color-line)" }}
    >
      {session && <OperativeCard session={session} />}

      <nav className="flex flex-col gap-0.5 p-3">
        {RAIL_NAV.map((item) => {
          const active = item.ready && pathname === item.href;
          const inner = (
            <>
              <span
                className="shrink-0"
                style={{
                  color: active
                    ? "var(--color-primary)"
                    : "var(--color-ink-faint)",
                }}
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
              {!item.ready && (
                <span
                  className="ml-auto font-mono text-[0.5rem] tracking-wider"
                  style={{ color: "var(--color-line-strong)" }}
                >
                  SOON
                </span>
              )}
            </>
          );

          const cls =
            "flex items-center gap-2.5 rounded-[2px] px-3 py-2.5 text-[0.85rem] transition-colors";

          return item.ready ? (
            <Link
              key={item.label}
              href={item.href}
              className={cls}
              style={{
                background: active ? "var(--color-blush)" : undefined,
                color: active ? "var(--color-primary)" : "var(--color-ink-dim)",
                fontWeight: active ? 600 : 400,
                borderLeft: `2px solid ${active ? "var(--color-accent)" : "transparent"}`,
              }}
            >
              {inner}
            </Link>
          ) : (
            <span
              key={item.label}
              className={`${cls} cursor-not-allowed`}
              style={{
                color: "var(--color-ink-ghost)",
                borderLeft: "2px solid transparent",
              }}
              title={`${item.label} — not built yet`}
            >
              {inner}
            </span>
          );
        })}
      </nav>
    </aside>
  );
}

/** Identity block at the top of the rail: name, rank, XP. */
function OperativeCard({ session }: { session: Session }) {
  const xp = session.xp ?? 0;
  const rank = rankFor(xp);

  return (
    <div
      className="m-3 flex items-center gap-3 border p-3"
      style={{
        borderColor: "var(--color-line)",
        background: "var(--color-blush)",
      }}
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center font-mono text-sm font-bold"
        style={{
          background: "var(--color-primary)",
          color: "var(--color-sand)",
        }}
      >
        {session.displayName.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0">
        <div className="truncate font-mono text-[0.78rem] font-semibold uppercase tracking-wide">
          {session.displayName}
        </div>
        <div className="label mt-0.5" style={{ color: "var(--color-accent)" }}>
          {rank.label}
        </div>
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer
      className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 sm:px-7"
      style={{
        borderColor: "var(--color-line)",
        background: "var(--color-surface-2)",
      }}
    >
      <span className="label">CombatX // Protocol 7.4.1</span>
      <span className="label" style={{ color: "var(--color-ink-ghost)" }}>
        Server-authoritative · Sandboxed execution
      </span>
    </footer>
  );
}

/* --- icons: 16px, currentColor, no dependency ---------------------------- */

function IconTerminal() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="2.5" width="13" height="11" stroke="currentColor" />
      <path d="M4 6l2 2-2 2M8.5 10.5H12" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="13" height="13" stroke="currentColor" />
      <path d="M4.5 10.5v-3M8 10.5v-5M11.5 10.5v-2" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 1.5l5.5 2v4c0 3-2.3 5.6-5.5 7-3.2-1.4-5.5-4-5.5-7v-4l5.5-2z" stroke="currentColor" />
    </svg>
  );
}
function IconMedal() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="10" r="4" stroke="currentColor" />
      <path d="M5.5 6.2L4 1.5h8l-1.5 4.7" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" />
      <path d="M8 1.5v1.8M8 12.7v1.8M14.5 8h-1.8M3.3 8H1.5M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3M12.6 12.6l-1.3-1.3M4.7 4.7L3.4 3.4" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}
