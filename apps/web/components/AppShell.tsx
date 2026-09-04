"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { ProfileResponse } from "@repo/protocol";
import { Logo } from "./Logo";
import { UserAvatar } from "./identity/UserIdentity";
import type { Session } from "../lib/session";

/**
 * The persistent application chrome: a top command bar, with screens rendered
 * beneath it. Every destination is reachable from that one bar.
 */

interface NavItem {
  label: string;
  href: string;
}

const TOP_NAV: NavItem[] = [
  { label: "Lobby", href: "/" },
  { label: "Arena", href: "/arena" },
  { label: "Leagues", href: "/leagues" },
  { label: "Rankings", href: "/rankings" },
  { label: "Archive", href: "/archive" },
  { label: "Intel", href: "/intel" },
];

export function AppShell({
  session,
  profile,
  children,
  right,
}: {
  session?: Session | null;
  /** Live progression, when the caller has fetched it. */
  profile?: ProfileResponse | null;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <CommandBar session={session} profile={profile} right={right} />
      <main className="min-w-0 flex-1">{children}</main>
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
          {/*
            The hero card only offers a room-code join, so this is the only
            entry point to an account for a signed-out visitor. Both are here
            rather than one: "Log in" is what a returning user looks for, and
            sending them through a signup page first is a dead end.
          */}
          {!session && (
            <>
              <Link
                href="/login"
                className="btn btn-ghost hidden sm:inline-flex"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="btn btn-primary hidden sm:inline-flex"
              >
                Sign up
              </Link>
            </>
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

          {/* The header's own auth buttons are sm-and-up only, so repeat them
              here or a signed-out phone visitor has no way to an account. */}
          {!session && (
            <div
              className="mt-2 flex gap-2 border-t pt-3"
              style={{ borderColor: "var(--color-line)" }}
            >
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="btn btn-ghost flex-1"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="btn btn-primary flex-1"
              >
                Sign up
              </Link>
            </div>
          )}
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
  const identity = {
    username: profile?.username ?? session.username,
    name: profile?.name ?? session.name,
    avatarId: profile?.avatarId ?? session.avatarId,
    avatarColor: profile?.avatarColor ?? session.avatarColor,
    imageUrl: profile?.imageUrl ?? session.imageUrl,
  };

  // A guest has no settings page to reach, so the chip offers the thing they
  // actually need — an account — rather than linking somewhere that would
  // just refuse them.
  const isGuest = profile?.isGuest ?? session.isGuest;

  return (
    <Link
      href={isGuest ? "/signup" : "/settings"}
      className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors"
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-line-strong)",
      }}
      title={isGuest ? "Create an account" : "Profile settings"}
    >
      <UserAvatar
        identity={identity}
        size={24}
        rounded={999}
      />
      <span className="max-w-28 truncate font-mono text-[0.72rem]">
        {identity.username}
      </span>
      {isGuest && (
        <span
          className="shrink-0 font-mono text-[0.6rem] uppercase tracking-wider"
          style={{ color: "var(--color-ink-ghost)" }}
        >
          guest
        </span>
      )}
    </Link>
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
