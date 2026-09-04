"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  LeagueDetailResponse,
  LeagueStandingsResponse,
} from "@repo/protocol";
import { AppShell } from "../../../../components/AppShell";
import { ErrorBanner, Spinner } from "../../../../components/atoms";
import { LeagueFlow } from "../../../../components/leagues/LeagueFlow";
import {
  LeagueLogo,
  LeagueStatusChip,
} from "../../../../components/leagues/LeagueBits";
import {
  ApiCallError,
  fetchLeague,
  fetchLeagueStandings,
} from "../../../../lib/api";
import { useSession } from "../../../../lib/useSession";
import { useProfile } from "../../../../lib/useProfile";

/**
 * The league, drawn as a competition rather than as a list of controls.
 *
 * Its own route, not a tab, so it can be linked and shared — "here is our
 * tournament" is a thing people send each other, and a tab state cannot be
 * put in a message. It is also the natural thing to open on a big screen
 * while a final is being played.
 *
 * Read-only by design: every control lives on the dashboard, and mixing
 * "look at the shape of this" with "change it" is what made the dashboard
 * need this page in the first place.
 */
export default function LeagueBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { session, loaded } = useSession();
  const { profile } = useProfile(session);

  const [detail, setDetail] = useState<LeagueDetailResponse | null>(null);
  const [standings, setStandings] = useState<LeagueStandingsResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([
        fetchLeague(id, session?.token),
        fetchLeagueStandings(id, session?.token),
      ]);
      setDetail(d);
      setStandings(s);
      setError(null);
    } catch (e) {
      setError(
        e instanceof ApiCallError ? e.message : "Could not load the league.",
      );
    } finally {
      setBusy(false);
    }
  }, [id, session]);

  useEffect(() => {
    if (!loaded) return;
    void load();
  }, [loaded, load]);

  // This is the page someone leaves open while a final is on, so it keeps
  // itself current — but only while something is actually being played.
  const live = detail?.fixtures.some((f) => f.status === "LIVE") ?? false;
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15_000);
    return () => clearInterval(t);
  }, [live, load]);

  return (
    <AppShell session={session} profile={profile}>
      {/*
        Wider than the rest of the app. A bracket is inherently horizontal and
        the standard 5xl column would force a scroll on a four-team knockout
        that comfortably fits a laptop screen.
      */}
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-7">
        {busy ? (
          <div className="flex justify-center py-24">
            <Spinner />
          </div>
        ) : !detail ? (
          <>
            <Link
              href="/leagues"
              className="font-mono text-[0.72rem]"
              style={{ color: "var(--color-ink-faint)" }}
            >
              &lsaquo; All leagues
            </Link>
            <div className="mt-4">
              <ErrorBanner message={error ?? "League not found."} />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <LeagueLogo
                  name={detail.league.name}
                  logoUrl={detail.league.logoUrl}
                  size={56}
                />
                <div className="min-w-0">
                  <Link
                    href={`/leagues/${id}`}
                    className="inline-flex items-center gap-1.5 font-mono text-[0.72rem] transition-colors hover:text-[var(--color-accent)]"
                    style={{ color: "var(--color-ink-faint)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path
                        d="M7.5 2.5 4 6l3.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Back to {detail.league.name}
                  </Link>
                  <h1 className="mt-1.5 text-2xl font-bold">
                    Tournament flow
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <LeagueStatusChip value={detail.league.status} />
                    <span
                      className="font-mono text-[0.68rem]"
                      style={{ color: "var(--color-ink-faint)" }}
                    >
                      run by {detail.league.hostName}
                    </span>
                  </div>
                </div>
              </div>

              <Link
                href={`/leagues/${id}`}
                className="btn btn-ghost shrink-0"
                title="Teams, matches and controls"
              >
                Open dashboard
              </Link>
            </div>

            {error && (
              <div className="mt-5">
                <ErrorBanner message={error} />
              </div>
            )}

            <div className="mt-8">
              <LeagueFlow detail={detail} standings={standings} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
