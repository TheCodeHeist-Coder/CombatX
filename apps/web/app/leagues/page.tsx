"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LeagueCard, LeagueStatus } from "@repo/protocol";
import { AppShell } from "../../components/AppShell";
import { ErrorBanner, Spinner } from "../../components/atoms";
import { LeagueListCard } from "../../components/leagues/LeagueBits";
import { ApiCallError, fetchLeagues, lookupLeague } from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useProfile } from "../../lib/useProfile";

/**
 * Leagues — one list of every league, filtered by state.
 *
 * THIS PAGE IS FOR PARTICIPANTS
 * -----------------------------
 * The overwhelming majority of people arriving here want to FIND a league to
 * play in, not run one. So the leagues themselves get the full width and the
 * whole page, and creating one is a single small control in the corner —
 * present for the few who want it, never competing with the list for
 * attention.
 *
 * ONE LIST, NOT TWO
 * -----------------
 * An earlier version split "your leagues" from "open to join", which meant
 * the same league moved between sections depending on who was looking and
 * the filters had to be applied twice. Now every league is one row in one
 * list; the ones you are in are simply marked, and sorted to the top.
 *
 * Reading stays open to a signed-out visitor: a league is the most social
 * thing on the site, and hiding the list behind a login would mean the only
 * people who ever see one are the people already in one.
 */

/**
 * The filter set.
 *
 * DRAFT is deliberately absent: it is a state a league passes through before
 * anyone can join, so a tab for it would be a tab onto nothing a participant
 * can act on. Such leagues still appear under "All".
 */
const FILTERS: { key: LeagueStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "RUNNING", label: "In progress" },
  { key: "FINISHED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default function LeaguesPage() {
  const { session, loaded } = useSession();
  const { profile } = useProfile(session);
  const router = useRouter();

  const [leagues, setLeagues] = useState<LeagueCard[]>([]);
  const [mineIds, setMineIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<LeagueStatus | "ALL">("ALL");

  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeFocus, setCodeFocus] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    fetchLeagues(session?.token)
      .then((res) => {
        if (!alive) return;
        // The server splits these because only "mine" may carry a join code.
        // The page wants one list, so merge them and remember which were
        // which — that flag is what marks and sorts a row, nothing more.
        const ids = new Set(res.mine.map((l) => l.id));
        setMineIds(ids);
        setLeagues([...res.mine, ...res.open.filter((l) => !ids.has(l.id))]);
      })
      .catch((e) => {
        if (!alive) return;
        setError(
          e instanceof ApiCallError ? e.message : "Could not load leagues.",
        );
      })
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [session, loaded]);

  /** How many leagues each tab would show, so a dead tab reads as dead. */
  const counts = useMemo(() => {
    const map = new Map<LeagueStatus | "ALL", number>([["ALL", leagues.length]]);
    for (const l of leagues) {
      map.set(l.status, (map.get(l.status) ?? 0) + 1);
    }
    return map;
  }, [leagues]);

  const shown = useMemo(() => {
    const list =
      filter === "ALL" ? leagues : leagues.filter((l) => l.status === filter);
    // Leagues you are in first — they are the ones you came back for — then
    // by the order the server sent, which is live-before-archived.
    return [...list].sort((a, b) => {
      const am = mineIds.has(a.id) ? 0 : 1;
      const bm = mineIds.has(b.id) ? 0 : 1;
      return am - bm;
    });
  }, [leagues, filter, mineIds]);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setCodeBusy(true);
    setCodeError(null);
    try {
      const league = await lookupLeague(trimmed, session?.token);
      router.push(`/leagues/${league.league.id}`);
    } catch (err) {
      setCodeError(
        err instanceof ApiCallError
          ? err.message
          : "Could not find that league.",
      );
    } finally {
      setCodeBusy(false);
    }
  }

  return (
    <AppShell session={session} profile={profile}>
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-7">
        {/* --- header --- */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="mt-2 text-2xl wordmark font-bold">Leagues</h1>
            <p
              className="mt-1.5 font-mono text-[0.74rem]"
              style={{ color: "var(--color-ink-dim)" }}
            >
              Join a tournament, or run one of your own.
            </p>
          </div>

          {/*
            A real button, not a faint link.
            
            The previous version was so understated it read as disabled. This
            is still secondary to the list — outlined in the accent rather
            than filled with it, so it does not compete with the leagues
            themselves — but it now looks like something you can press.
          */}
          {session && !session.isGuest && (
            <Link
              href="/leagues/new"
              className="btn shrink-0"
              style={{
                borderColor: "var(--color-primary)",
                color: "var(--color-accent)",
                background:
                  "color-mix(in srgb, var(--color-primary) 10%, transparent)",
              }}
              title="Run your own tournament"
            >
              <IconPlus />
              Create a league
            </Link>
          )}
        </div>

        {/* --- filters + code entry, on one row at desktop width --- */}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          {/*
            Segmented control rather than loose buttons.

            One enclosure with dividers reads as a single choice with five
            options; five separate chips read as five independent toggles you
            might be able to combine. The filter is exclusive, so it should
            look exclusive.
          */}
          {/*
            SCROLLS, rather than clipping.

            Five tabs do not fit a 390px screen, and `overflow-hidden` on the
            enclosure quietly cut the last one off — leaving "Cancelled"
            visible as a sliver and completely unreachable on a phone. The row
            now scrolls sideways instead, so every filter can be reached at
            any width. `shrink-0` on each tab stops flexbox from squeezing
            them into two-line labels rather than overflowing.
          */}
          <div
            className="flex max-w-full overflow-x-auto rounded-[8px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              border: "1px solid var(--color-line-strong)",
              background: "var(--color-surface-2)",
            }}
            role="tablist"
            aria-label="Filter leagues by state"
          >
            {FILTERS.map((f, i) => {
              const n = counts.get(f.key) ?? 0;
              const active = filter === f.key;
              const empty = n === 0 && f.key !== "ALL";
              return (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.key)}
                  className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 font-mono text-[0.72rem] transition-colors sm:px-3.5"
                  style={{
                    color: active
                      ? "var(--color-ink)"
                      : empty
                        ? "var(--color-ink-ghost)"
                        : "var(--color-ink-dim)",
                    background: active
                      ? "var(--color-primary)"
                      : "transparent",
                    borderLeft:
                      i === 0 ? "none" : "1px solid var(--color-line)",
                  }}
                >
                  {f.label}
                  {/*
                    The count rides in a pill so it reads as a quantity rather
                    than as part of the label — "Open 1" could otherwise be
                    mistaken for a name.
                  */}
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[0.62rem] leading-none"
                    style={{
                      background: active
                        ? "rgba(0,0,0,0.22)"
                        : "var(--color-surface-3)",
                      color: active
                        ? "#ffffff"
                        : empty
                          ? "var(--color-ink-ghost)"
                          : "var(--color-ink-faint)",
                    }}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>

          {/*
            Code entry as one bonded control.

            A bare input next to a bare button did not say what it was for.
            Now the field, its label and its action sit in a single bordered
            group that lights up on focus, so it reads as "put a code in
            here" without needing a heading of its own.
          */}
          <form
            onSubmit={go}
            className="flex w-full items-stretch overflow-hidden rounded-[8px] transition-colors sm:w-auto"
            style={{
              border: `1px solid ${
                codeFocus ? "var(--color-primary)" : "var(--color-line-strong)"
              }`,
              background: "var(--color-surface-3)",
              boxShadow: codeFocus
                ? "0 0 0 3px rgba(242, 98, 46, 0.18)"
                : undefined,
            }}
          >
            <span
              className="flex items-center gap-1.5 pl-3 pr-2 font-mono text-[0.62rem] uppercase tracking-wider"
              style={{ color: "var(--color-ink-ghost)" }}
              aria-hidden
            >
              <IconKey />
              code
            </span>
            {/*
              The placeholder needs its own colour: at full ink it reads as a
              code somebody already typed, and the Join button beside it looks
              wrongly disabled.
            */}
            <input
              aria-label="League join code"
              className="league-code min-w-0 flex-1 bg-transparent py-2 font-mono text-[0.82rem] uppercase tracking-[0.22em] outline-none sm:w-[7.5rem] sm:flex-none"
              style={{ color: "var(--color-ink)" }}
              placeholder="ABC123"
              value={code}
              maxLength={12}
              onFocus={() => setCodeFocus(true)}
              onBlur={() => setCodeFocus(false)}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoComplete="off"
            />
            <button
              type="submit"
              className="px-3.5 font-mono text-[0.7rem] uppercase tracking-wider transition-colors disabled:opacity-40"
              style={{
                borderLeft: "1px solid var(--color-line-strong)",
                background:
                  code.trim().length >= 4
                    ? "var(--color-primary)"
                    : "var(--color-surface-2)",
                color:
                  code.trim().length >= 4
                    ? "#ffffff"
                    : "var(--color-ink-ghost)",
              }}
              disabled={codeBusy || code.trim().length < 4}
            >
              {codeBusy ? <Spinner /> : "Join"}
            </button>
          </form>
        </div>

        {codeError && (
          <div className="mt-4">
            <ErrorBanner message={codeError} />
          </div>
        )}
        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} />
          </div>
        )}

        {/* --- the list --- */}
        {busy ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            filter={filter}
            anyAtAll={leagues.length > 0}
            canCreate={!!session && !session.isGuest}
          />
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            {shown.map((l) => (
              <LeagueListCard
                key={l.id}
                league={l}
                joined={mineIds.has(l.id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/**
 * Nothing to show.
 *
 * Says which of the two very different situations this is: the filter is
 * empty but other leagues exist, or there are no leagues at all. Only the
 * second is a reason to offer creating one.
 */
function EmptyState({
  filter,
  anyAtAll,
  canCreate,
}: {
  filter: LeagueStatus | "ALL";
  anyAtAll: boolean;
  canCreate: boolean;
}) {
  const label =
    FILTERS.find((f) => f.key === filter)?.label.toLowerCase() ?? "matching";

  return (
    <div className="panel mt-5 p-10 text-center">
      <p
        className="font-mono text-[0.8rem]"
        style={{ color: "var(--color-ink-dim)" }}
      >
        {anyAtAll
          ? `No ${label} leagues right now.`
          : "No leagues have been created yet."}
      </p>
      {!anyAtAll &&
        (canCreate ? (
          <Link href="/leagues/new" className="btn btn-primary mt-4">
            Start the first one
          </Link>
        ) : (
          <Link href="/signup" className="btn btn-primary mt-4">
            Create an account to start one
          </Link>
        ))}
    </div>
  );
}

/* --- icons: hand-drawn, currentColor, no dependency ---------------------- */

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M6.5 2.5v8M2.5 6.5h8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A key, for the join-code field.
 *
 * Drawn HORIZONTALLY — a round bow on the left, a straight shaft, and two
 * teeth dropping from its end. Two earlier attempts placed the ring on a
 * diagonal shaft, which at 12px is the exact silhouette of a magnifying
 * glass and read as "search", telling the visitor to look for a league
 * rather than to unlock one. A horizontal key cannot be misread that way.
 */
function IconKey() {
  return (
    <svg width="13" height="12" viewBox="0 0 13 12" fill="none" aria-hidden>
      <circle cx="3.6" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M6.2 6h5.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* The teeth — what makes it a key rather than a lollipop. */}
      <path
        d="M9.4 6v2.1M11.6 6v1.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
