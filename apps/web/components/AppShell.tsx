"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { ProfileResponse } from "@repo/protocol";
import { Logo } from "./Logo";
import { UserAvatar } from "./identity/UserIdentity";
import { NotificationBell } from "./NotificationBell";
import type { Session } from "../lib/session";
import {
  IconMapPin,
  IconGitHub,
  IconX,
  IconLinkedIn,
  IconMail,
  IconQuestion,
  IconUsers,
  IconRoadmap,
  IconPhone,
} from "./icons";

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
          {/* Guests have nothing to be notified about — no league, no team. */}
          {session && !session.isGuest && (
            <NotificationBell session={session} />
          )}
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
      className="mt-auto"
      style={{
        background: "var(--color-void)",
      }}
    >
      <div className="mx-auto w-full max-w-[1440px] px-5 py-6 sm:px-8">

        {/* MAIN FOOTER */}
        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr_1fr]">

          {/* LEFT */}
          <div>
            <div className="flex items-center gap-2">
              <Logo size="sm" />

              <span
                className="font-mono text-[1.25rem] font-black uppercase tracking-[0.12em]"
                style={{ color: "#f5f7fb" }}
              >
                COMBATX
              </span>
            </div>

            <p
              className="mt-3 text-[1rem] font-semibold"
              style={{ color: "#f5f7fb" }}
            >
              Made by Raj{" "}
              <span style={{ color: "#ff8a3d" }}>♥</span>
            </p>

            <p
              className="mt-2 max-w-[20rem] text-[0.78rem] leading-relaxed"
              style={{ color: "rgba(255,255,255,0.58)" }}
            >
              A modern multiplayer gaming experience crafted with passion.
              Built for players, driven by community.
            </p>

            {/* small orange line */}
            <div
              className="mt-4 h-px w-20"
              style={{ background: "rgba(255,138,61,0.7)" }}
            />

            <div
              className="mt-3 flex items-center gap-2 text-[0.78rem]"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              <span style={{ color: "#ff8a3d" }}>
                <IconMapPin/>
              </span>

              <span>Knit Sultanpur, UP, India</span>
            </div>

            {/* SOCIAL BUTTONS */}
            <div className="mt-4 flex items-center gap-3">

              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:-translate-y-1"
                style={{
                  color: "#f5f7fb",
                  background: "rgba(255,255,255,0.04)",
                  boxShadow: "0 0 14px rgba(255,138,61,0.08)",
                }}
              >
                <IconGitHub />
              </a>

              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Twitter"
                className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:-translate-y-1"
                style={{
                  color: "#f5f7fb",
                  background: "rgba(255,255,255,0.04)",
                  boxShadow: "0 0 14px rgba(255,138,61,0.08)",
                }}
              >
                <IconX />
              </a>

              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:-translate-y-1"
                style={{
                  color: "#f5f7fb",
                  background: "rgba(255,255,255,0.04)",
                  boxShadow: "0 0 14px rgba(255,138,61,0.08)",
                }}
              >
                <IconLinkedIn />
              </a>

              <a
                href="mailto:raj@combatx.dev"
                aria-label="Email"
                className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:-translate-y-1"
                style={{
                  color: "#f5f7fb",
                  background: "rgba(255,255,255,0.04)",
                  boxShadow: "0 0 14px rgba(255,138,61,0.08)",
                }}
              >
                <IconMail />
              </a>

            </div>
          </div>


          {/* CENTER */}
          <div>

            <div className="flex items-center gap-3 text-[0.68rem] font-medium uppercase tracking-[0.2em]">
              <span style={{ color: "#ff8a3d" }}>
                Explore
              </span>

              <span
                className="h-px flex-1"
                style={{ background: "rgba(255,138,61,0.45)" }}
              />

              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: "#ff8a3d",
                  boxShadow: "0 0 8px rgba(255,138,61,0.8)",
                }}
              />
            </div>


            <div className="mt-4 space-y-2.5">

              {/* HELP */}
              <button
                type="button"
                className="group flex w-full items-center justify-between rounded-xl px-4 py-3 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,138,61,0.16), rgba(255,138,61,0.05))",
                  boxShadow:
                    "0 8px 22px rgba(255,138,61,0.08)",
                }}
              >
                <span className="flex items-center gap-3">

                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      color: "#ff8a3d",
                      background: "rgba(255,138,61,0.10)",
                    }}
                  >
                    <IconQuestion />
                  </span>

                  <span
                    className="text-[0.9rem] font-medium"
                    style={{ color: "#f5f7fb" }}
                  >
                    Help Center
                  </span>

                </span>

                <span
                  className="text-[1.25rem] transition-transform duration-200 group-hover:translate-x-1"
                  style={{ color: "#ff8a3d" }}
                >
                  →
                </span>
              </button>


              {/* TEAM */}
              <button
                type="button"
                className="group flex w-full items-center justify-between rounded-xl px-4 py-3 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,138,61,0.16), rgba(255,138,61,0.05))",
                  boxShadow:
                    "0 8px 22px rgba(255,138,61,0.08)",
                }}
              >
                <span className="flex items-center gap-3">

                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      color: "#ff8a3d",
                      background: "rgba(255,138,61,0.10)",
                    }}
                  >
                    <IconUsers />
                  </span>

                  <span
                    className="text-[0.9rem] font-medium"
                    style={{ color: "#f5f7fb" }}
                  >
                    Team Section
                  </span>

                </span>

                <span
                  className="text-[1.25rem] transition-transform duration-200 group-hover:translate-x-1"
                  style={{ color: "#ff8a3d" }}
                >
                  →
                </span>
              </button>


              {/* ROADMAP */}
              <button
                type="button"
                className="group flex w-full items-center justify-between rounded-xl px-4 py-3 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <span className="flex items-center gap-3">

                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      color: "#ff8a3d",
                      background: "rgba(255,138,61,0.06)",
                    }}
                  >
                    <IconRoadmap />
                  </span>

                  <span
                    className="text-[0.9rem] font-medium"
                    style={{ color: "#f5f7fb" }}
                  >
                    Roadmap
                  </span>

                </span>

                <span
                  className="text-[1.25rem] transition-transform duration-200 group-hover:translate-x-1"
                  style={{ color: "#ff8a3d" }}
                >
                  →
                </span>
              </button>

            </div>
          </div>


          {/* RIGHT */}
          <div>

            <div className="flex items-center gap-3 text-[0.68rem] font-medium uppercase tracking-[0.2em]">
              <span style={{ color: "#ff8a3d" }}>
                Connect
              </span>

              <span
                className="h-px flex-1"
                style={{ background: "rgba(255,138,61,0.45)" }}
              />

              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: "#ff8a3d",
                  boxShadow: "0 0 8px rgba(255,138,61,0.8)",
                }}
              />
            </div>


            <p
              className="mt-4 text-[0.78rem]"
              style={{ color: "rgba(255,255,255,0.58)" }}
            >
              For work, collaborations, or just to connect.
            </p>


            <div className="mt-5 space-y-3">

              <div
                className="flex items-center gap-3 text-[0.8rem]"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                <span style={{ color: "#ff8a3d" }}>
                  <IconPhone />
                </span>

                <span>+91 98765 43210</span>
              </div>


              <div
                className="flex items-center gap-3 text-[0.8rem]"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                <span style={{ color: "#ff8a3d" }}>
                  <IconMail />
                </span>

                <span>raj@combatx.dev</span>
              </div>

            </div>

          </div>

        </div>


        {/* BOTTOM */}
        <div
          className="mt-6 flex flex-col items-center justify-between gap-3 pt-4 text-[0.68rem] sm:flex-row"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >

          <div>
            © 2024{" "}
            <span style={{ color: "#ff8a3d" }}>
              COMBATX
            </span>
            . All rights reserved.
          </div>


          <div
            className="flex items-center gap-2 uppercase tracking-[0.18em]"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            <span style={{ color: "#ff8a3d" }}>✦</span>

            <span>THANK YOU, PLAYER.</span>

            <span style={{ color: "#ff8a3d" }}>✦</span>
          </div>


          <div className="flex items-center gap-1.5">
            <span>Made with</span>

            <span style={{ color: "#ff8a3d" }}>
              ♥
            </span>

            <span>
              by{" "}
              <span style={{ color: "#ff8a3d" }}>
                Raj
              </span>
            </span>
          </div>

        </div>

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
