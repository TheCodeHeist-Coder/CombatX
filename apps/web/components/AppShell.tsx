"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { ProfileResponse } from "@repo/protocol";
import { rankFor, rankProgress } from "@repo/game";
import { Logo } from "./Logo";
import { Avatar } from "./avatar/Avatar";
import type { Session } from "../lib/session";

/**
 * The persistent application chrome: a top command bar plus an optional left
 * rail. Screens render inside it.
 *
 * Every destination routes; the rail only appears on dashboard-style screens
 * so the landing page stays full-bleed.
 */

interface NavItem {
  label: string;
  href: string;
}

const TOP_NAV: NavItem[] = [
  { label: "Lobby", href: "/" },
  { label: "Arena", href: "/arena" },
  { label: "Rankings", href: "/rankings" },
  { label: "Archive", href: "/archive" },
  { label: "Intel", href: "/intel" },
];

const RAIL_NAV: (NavItem & { icon: ReactNode })[] = [
  { label: "Mission Control", href: "/", icon: <IconTerminal /> },
  { label: "Tactical Feed", href: "/feed", icon: <IconChart /> },
  { label: "Armory", href: "/armory", icon: <IconShield /> },
  { label: "Rankings", href: "/rankings", icon: <IconMedal /> },
  { label: "Settings", href: "/settings", icon: <IconGear /> },
];

export function AppShell({
  session,
  profile,
  children,
  rail = false,
  right,
}: {
  session?: Session | null;
  /** Live progression, when the caller has fetched it. */
  profile?: ProfileResponse | null;
  children: ReactNode;
  /** Show the left navigation rail (dashboard-style screens). */
  rail?: boolean;
  right?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <CommandBar session={session} profile={profile} right={right} />
      <div className="flex flex-1">
        {rail && <NavRail session={session} profile={profile} />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <SiteFooter />
    </div>
  );
}

function CommandBar({
  session,
  profile,
  right,
}: {
  session?: Session | null;
  profile?: ProfileResponse | null;
  right?: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-30 "
      style={{
        borderColor: "var(--color-line)",
        background: "color-mix(in srgb, var(--color-void) 85%, transparent)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-x-7 px-5 py-3 sm:px-7">
        <Link href="/" className="transition-opacity hover:opacity-75">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {TOP_NAV.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              active={pathname === item.href}
            />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {right}
          {session && <IdentityChip session={session} profile={profile} />}
          {!session && (
            <Link href="/#deploy" className="btn btn-primary hidden sm:inline-flex">
              Play now
            </Link>
          )}

          <button
            className="md:hidden"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{ color: "var(--color-ink-dim)" }}
          >
            <IconMenu />
          </button>
        </div>
      </div>

      {/* Mobile nav — the top links collapse here below md. */}
      {open && (
        <nav
          className="flex flex-col gap-0.5 border-t px-5 py-3 md:hidden"
          style={{ borderColor: "var(--color-line)" }}
        >
          {TOP_NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="nav-link rounded-[6px] px-3 py-2.5 text-[0.9rem]"
              style={{
                color:
                  pathname === item.href
                    ? "var(--color-accent)"
                    : "var(--color-ink-dim)",
                background:
                  pathname === item.href
                    ? "var(--color-surface-2)"
                    : undefined,
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className="nav-link relative px-2.5 py-1.5 text-[0.85rem] transition-colors"
      style={{ color: active ? "var(--color-accent)" : "var(--color-ink-dim)" }}
    >
      {item.label}
      {active && (
        <span
          className="absolute inset-x-2.5 -bottom-[13px] h-0.5"
          style={{ background: "var(--color-primary)" }}
        />
      )}
    </Link>
  );
}

/** Avatar + callsign in the command bar. Links to settings to change either. */
function IdentityChip({
  session,
  profile,
}: {
  session: Session;
  profile?: ProfileResponse | null;
}) {
  // Prefer the freshly-fetched profile: it reflects a change made in another
  // tab, where the stored session copy could still be stale.
  const avatarId = profile?.avatarId ?? session.avatarId;
  const avatarColor = profile?.avatarColor ?? session.avatarColor;

  return (
    <Link
      href="/settings"
      className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors"
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-line-strong)",
      }}
      title="Profile settings"
    >
      <Avatar
        avatarId={avatarId}
        color={avatarColor}
        size={24}
        rounded={999}
      />
      <span className="max-w-28 truncate font-mono text-[0.72rem]">
        {profile?.displayName ?? session.displayName}
      </span>
    </Link>
  );
}

function NavRail({
  session,
  profile,
}: {
  session?: Session | null;
  profile?: ProfileResponse | null;
}) {
  const pathname = usePathname();

  return (
    <aside
      className="hidden w-60 shrink-0 flex-col border-r lg:flex"
      style={{ borderColor: "var(--color-line)" }}
    >
      {session && <OperativeCard session={session} profile={profile} />}

      <nav className="flex flex-col gap-0.5 p-3">
        {RAIL_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-2.5 rounded-[6px] px-3 py-2.5 text-[0.85rem] transition-colors"
              style={{
                background: active ? "var(--color-surface-2)" : undefined,
                color: active ? "var(--color-accent)" : "var(--color-ink-dim)",
                fontWeight: active ? 600 : 400,
                borderLeft: `2px solid ${active ? "var(--color-primary)" : "transparent"}`,
              }}
            >
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
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/**
 * Identity block at the top of the rail: character, callsign, rank, and
 * progress to the next tier. Rank is derived from real XP via the same pure
 * function the server uses, so the badge can never disagree with the award.
 */
function OperativeCard({
  session,
  profile,
}: {
  session: Session;
  profile?: ProfileResponse | null;
}) {
  const xp = profile?.xp ?? 0;
  const rank = rankFor(xp);
  const progress = rankProgress(xp);

  return (
    <div
      className="m-3 rounded-[10px] border p-3"
      style={{
        borderColor: "var(--color-line)",
        background: "var(--color-surface)",
      }}
    >
      <div className="flex items-center gap-3">
        <Avatar
          avatarId={profile?.avatarId ?? session.avatarId}
          color={profile?.avatarColor ?? session.avatarColor}
          size={40}
          rounded={8}
        />
        <div className="min-w-0">
          <div className="truncate font-mono text-[0.8rem] font-semibold">
            {profile?.displayName ?? session.displayName}
          </div>
          <div className="label mt-0.5" style={{ color: "var(--color-accent)" }}>
            {rank.label}
          </div>
        </div>
      </div>

      {profile && (
        <div className="mt-3">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--color-surface-3)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round(progress * 100)}%`,
                background:
                  "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
              }}
            />
          </div>
          <div className="mt-1.5 flex justify-between">
            <span className="label">{profile.xp} XP</span>
            <span className="label">
              {profile.wins}W / {profile.losses}L
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SiteFooter() {
  return (
    <footer
      className="mt-auto border-t"
      style={{
        borderColor: "var(--color-line)",
        background: "var(--color-surface)",
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7">
        <Logo size="sm" />
        <span className="label" style={{ color: "var(--color-ink-ghost)" }}>
          Server-authoritative · Sandboxed execution
        </span>
      </div>
    </footer>
  );
}

/* --- icons: 16px, currentColor, no dependency ---------------------------- */

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconTerminal() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" />
      <path d="M4 6l2 2-2 2M8.5 10.5H12" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" />
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
