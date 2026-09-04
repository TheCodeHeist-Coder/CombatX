"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NotificationView } from "@repo/protocol";
import { fetchNotifications, markNotificationsRead } from "../lib/api";
import type { Session } from "../lib/session";

/**
 * The notification bell in the command bar.
 *
 * WHY IT POLLS
 * ------------
 * A league event happens on the HTTP API — a host schedules a match — while
 * the only live socket in this product belongs to a battle room the user is
 * probably not in. Pushing would mean a second always-on socket per signed-in
 * visitor for something that changes a few times an hour.
 *
 * So it polls, slowly, and stops entirely when the tab is hidden. That costs
 * one small indexed query per minute per open tab, and the badge is correct
 * within a minute of anything happening — which for "your match is at 9" is
 * the right trade.
 */

/** How often to check. Slow enough to be cheap, fast enough to be useful. */
const POLL_MS = 60_000;

export function NotificationBell({ session }: { session: Session }) {
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchNotifications(session.token);
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      // A failed poll is not worth telling anyone about; the next one will
      // either work or the rest of the page will already be showing an error.
    }
  }, [session.token]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      // A hidden tab does not need to poll — and a browser throttles it
      // anyway, so this only makes the sleeping explicit.
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    // Check immediately on returning to the tab, rather than waiting out the
    // remainder of an interval that ticked while it was hidden.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Close on an outside click, the way every dropdown is expected to.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      // Opening the panel IS reading them. Clear the badge optimistically so
      // it does not linger for a round trip after the user has plainly seen
      // everything in it.
      setUnread(0);
      try {
        await markNotificationsRead(session.token);
        await load();
      } catch {
        void load();
      }
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => void toggle()}
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-full transition-colors"
        style={{
          background: open ? "var(--color-surface-2)" : "transparent",
          color: unread > 0 ? "var(--color-accent)" : "var(--color-ink-dim)",
        }}
      >
        <IconBell />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[0.58rem] font-bold"
            style={{ background: "var(--color-primary)", color: "#fff" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          /*
           * Anchored to the bell on a wide screen, pinned to the viewport on a
           * narrow one.
           *
           * A right-anchored panel wider than the space to the bell's left
           * hangs off the edge of the page — measured at 390px it sat 120px
           * off-screen, clipping the text and putting part of it out of reach.
           * `fixed` below sm takes it out of the bell's coordinate space so it
           * can span the screen with a margin either side.
           */
          className="fixed inset-x-4 top-14 z-50 overflow-hidden rounded-[10px] border shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[22rem]"
          style={{
            borderColor: "var(--color-line-strong)",
            background: "var(--color-surface)",
          }}
        >
          <div
            className="border-b px-4 py-2.5"
            style={{ borderColor: "var(--color-line)" }}
          >
            <span className="font-mono text-[0.68rem] uppercase tracking-wider" style={{ color: "var(--color-ink-faint)" }}>
              Notifications
            </span>
          </div>

          {items.length === 0 ? (
            <p
              className="px-4 py-8 text-center font-mono text-[0.74rem]"
              style={{ color: "var(--color-ink-faint)" }}
            >
              Nothing yet.
            </p>
          ) : (
            <div className="max-h-[26rem] overflow-y-auto">
              {items.map((n) => (
                <Row key={n.id} item={n} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  item,
  onNavigate,
}: {
  item: NotificationView;
  onNavigate: () => void;
}) {
  const unread = item.readAt === null;
  const body = (
    <div
      className="border-b px-4 py-3 transition-colors last:border-b-0"
      style={{
        borderColor: "var(--color-line)",
        background: unread
          ? "color-mix(in srgb, var(--color-primary) 6%, transparent)"
          : undefined,
      }}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: unread ? "var(--color-primary)" : "transparent",
          }}
        />
        <div className="min-w-0">
          <p className="text-[0.8rem] font-bold leading-snug">{item.title}</p>
          {item.body && (
            <p
              className="mt-0.5 font-mono text-[0.68rem] leading-[1.6]"
              style={{ color: "var(--color-ink-dim)" }}
            >
              {item.body}
            </p>
          )}
          <p
            className="mt-1 font-mono text-[0.62rem]"
            style={{ color: "var(--color-ink-ghost)" }}
          >
            {relativeTime(item.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );

  // A notification with nowhere to go is still worth showing — it is not
  // wrapped in a link that would do nothing when clicked.
  return item.link ? (
    <Link href={item.link} onClick={onNavigate} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

/**
 * "4m ago". Coarse on purpose: the exact second something was scheduled is
 * never the point, and a ticking timestamp would force a re-render a minute.
 */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function IconBell() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M9 2.2a4.4 4.4 0 0 0-4.4 4.4c0 3.4-1.1 4.5-1.1 4.5h11c0 0-1.1-1.1-1.1-4.5A4.4 4.4 0 0 0 9 2.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M7.6 13.6a1.6 1.6 0 0 0 2.8 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
