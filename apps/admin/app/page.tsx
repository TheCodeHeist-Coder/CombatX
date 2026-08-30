"use client";

import { useEffect, useState } from "react";
import type { AdminOverviewResponse, DailyCount } from "@repo/protocol";
import { TIERS } from "@repo/game";
import { AdminShell } from "../components/AdminShell";
import {
  Chip,
  ErrorBanner,
  IconDoc,
  IconEye,
  IconGhost,
  IconPulse,
  IconSwords,
  IconUpload,
  IconUsers,
  PageHeader,
  Spinner,
  Stat,
} from "../components/atoms";
import { fetchOverview, AdminApiError } from "../lib/api";
import { useAdminSession } from "../lib/useAdminSession";

/** How often the dashboard re-polls. Live counts go stale fast. */
const REFRESH_MS = 30_000;

export default function OverviewPage() {
  return (
    <AdminShell>
      <Overview />
    </AdminShell>
  );
}

function Overview() {
  const { session } = useAdminSession();
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!session) return;
    let alive = true;

    const load = () => {
      fetchOverview(session.token)
        .then((d) => {
          if (!alive) return;
          setData(d);
          setUpdatedAt(new Date());
          setError(null);
        })
        .catch(
          (err) =>
            alive &&
            setError(
              err instanceof AdminApiError
                ? err.message
                : "Could not load the dashboard.",
            ),
        );
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [session]);

  if (error) return <ErrorBanner message={error} />;
  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-9">
      <PageHeader
        eyebrow="Live"
        title="Overview"
        lede="Everything below refreshes every 30 seconds."
        actions={
          updatedAt ? (
            <Chip color="var(--color-good)">
              <span className="live-dot" aria-hidden />
              Updated{" "}
              {updatedAt.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </Chip>
          ) : undefined
        }
      />

      <Section title="Players">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            className="rise rise-1"
            label="Online now"
            // Null means ws-server did not answer — "—" rather than a
            // confident 0, which would read as "nobody is playing".
            value={data.users.onlineNow ?? "—"}
            live={data.users.onlineNow !== null}
            sub={
              data.users.onlineNow === null
                ? "ws-server unreachable"
                : "connected to a battle room"
            }
            accent="var(--color-good)"
            icon={<IconPulse />}
          />
          <Stat
            className="rise rise-2"
            label="Active today"
            value={data.users.activeToday}
            sub={`${data.users.activeWeek} in the last 7 days`}
            accent="var(--color-primary)"
            icon={<IconSwords />}
          />
          <Stat
            className="rise rise-3"
            label="Registered"
            value={data.users.registered}
            sub={
              <>
                <Delta n={data.users.signupsToday} /> today ·{" "}
                <Delta n={data.users.signupsWeek} /> this week
              </>
            }
            accent="var(--color-violet)"
            icon={<IconUsers />}
          />
          <Stat
            className="rise rise-4"
            label="Guests"
            value={data.users.guests}
            sub={`${data.users.total} rows in total`}
            accent="var(--color-ink-faint)"
            icon={<IconGhost />}
          />
        </div>
      </Section>

      <Section title="Battles">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Total battles"
            value={data.battles.total}
            sub={`${data.battles.finished} finished`}
            accent="var(--color-side-a)"
            icon={<IconSwords />}
          />
          <Stat
            label="In progress"
            value={data.battles.inProgress}
            live={data.battles.inProgress > 0}
            sub="lobby, countdown or running"
            accent="var(--color-warn)"
            icon={<IconPulse />}
          />
          <Stat
            label="Started today"
            value={data.battles.today}
            sub={`${data.battles.week} this week`}
            accent="var(--color-primary)"
            icon={<IconSwords />}
          />
          <Stat
            label="Submissions"
            value={data.submissions.total.toLocaleString()}
            sub={`${data.submissions.today} today`}
            accent="var(--color-side-b)"
            icon={<IconUpload />}
          />
        </div>
      </Section>

      <Section title="Ladder">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Placed"
            value={data.ranking.placed}
            sub={`${data.ranking.placing} still placing`}
            accent="var(--color-primary)"
            icon={<IconPulse />}
          />
          <Stat
            label="In queue"
            value={data.ranking.queued}
            live={data.ranking.queued > 0}
            sub="waiting for a ranked match"
            accent="var(--color-good)"
            icon={<IconSwords />}
          />
          <Stat
            label="Ranked battles"
            value={data.battles.ranked}
            sub={`of ${data.battles.total} total`}
            accent="var(--color-side-a)"
            icon={<IconSwords />}
          />
          <Stat
            label="Badges awarded"
            value={data.ranking.badgesAwarded}
            sub={
              data.ranking.topRating !== null
                ? `top rating ${data.ranking.topRating}`
                : "no placed players yet"
            }
            accent="var(--color-accent)"
            icon={<IconDoc />}
          />
        </div>

        {/* The tier histogram. Only drawn once somebody is placed — an all-zero
            chart says nothing and looks broken. */}
        {data.ranking.placed > 0 && (
          <div className="panel panel-lit mt-3.5 p-5">
            <h3 className="label">Tier distribution</h3>
            <ul className="mt-3.5 flex flex-col gap-2">
              {TIERS.map((t) => {
                const n = data.ranking.byTier[t.key] ?? 0;
                const pct = (n / data.ranking.placed) * 100;
                return (
                  <li key={t.key}>
                    <div className="flex items-baseline justify-between gap-4 font-mono text-[0.74rem]">
                      <span>{t.label}</span>
                      <span
                        className="tabular-nums"
                        style={{ color: "var(--color-ink-faint)" }}
                      >
                        {n}
                      </span>
                    </div>
                    <div
                      className="mt-1 h-[3px] rounded-full"
                      style={{ background: "var(--color-surface-3)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(n > 0 ? 4 : 0, pct)}%`,
                          background: t.color,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Traffic & content">
        <div className="grid gap-3.5 lg:grid-cols-[1fr_1fr_1fr_1.4fr]">
          <Stat
            label="Page views"
            value={data.traffic.totalViews.toLocaleString()}
            sub={`${data.traffic.viewsToday} today`}
            accent="var(--color-magenta)"
            icon={<IconEye />}
          />
          <Stat
            label="Unique visitors"
            value={data.traffic.uniqueVisitors30d.toLocaleString()}
            sub="distinct browsers, 30 days"
            accent="var(--color-magenta)"
            icon={<IconUsers />}
          />
          <Stat
            label="Problems"
            value={data.problems.total}
            sub={Object.entries(data.problems.byDifficulty)
              .map(([k, v]) => `${v} ${k.toLowerCase()}`)
              .join(" · ")}
            accent="var(--color-accent)"
            icon={<IconDoc />}
          />

          <div className="panel panel-lit p-5">
            <h3 className="label">Most visited · 30 days</h3>
            {data.traffic.topPaths.length === 0 ? (
              <p
                className="mt-4 font-mono text-[0.72rem]"
                style={{ color: "var(--color-ink-ghost)" }}
              >
                No page views recorded yet.
              </p>
            ) : (
              <ul className="mt-3.5 flex flex-col gap-2">
                {data.traffic.topPaths.map((p) => {
                  const max = data.traffic.topPaths[0]?.count || 1;
                  return (
                    <li key={p.path}>
                      <div className="flex items-baseline justify-between gap-4 font-mono text-[0.74rem]">
                        <span className="truncate">{p.path}</span>
                        <span
                          className="tabular-nums"
                          style={{ color: "var(--color-ink-faint)" }}
                        >
                          {p.count.toLocaleString()}
                        </span>
                      </div>
                      {/* A proportional bar under each row — the ranking is
                          much easier to read than the raw numbers alone. */}
                      <div
                        className="mt-1 h-[3px] rounded-full"
                        style={{ background: "var(--color-surface-3)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(4, (p.count / max) * 100)}%`,
                            background: "var(--color-primary)",
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Section>

      <Section title="Last 14 days">
        <div className="grid gap-3.5 lg:grid-cols-3">
          <Sparkline
            title="Signups"
            series={data.trend.signups}
            color="var(--color-violet)"
          />
          <Sparkline
            title="Battles"
            series={data.trend.battles}
            color="var(--color-side-a)"
          />
          <Sparkline
            title="Page views"
            series={data.trend.views}
            color="var(--color-magenta)"
          />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3.5 flex items-center gap-3">
        <h2 className="label">{title}</h2>
        <span
          className="h-px flex-1"
          style={{
            background:
              "linear-gradient(90deg, var(--color-line), transparent)",
          }}
        />
      </div>
      {children}
    </section>
  );
}

/** A +n in green, or a muted 0. */
function Delta({ n }: { n: number }) {
  return (
    <span style={{ color: n > 0 ? "var(--color-good)" : "inherit" }}>
      {n > 0 ? `+${n}` : n}
    </span>
  );
}

/**
 * A bar chart of one daily series.
 *
 * Bars rather than a line: the values are counts of discrete events, and a
 * line implies a continuous quantity that was sampled. Heights scale to the
 * series max, with a floor so a non-zero day is never invisible.
 */
function Sparkline({
  title,
  series,
  color,
}: {
  title: string;
  series: DailyCount[];
  color: string;
}) {
  const max = Math.max(1, ...series.map((d) => d.count));
  const total = series.reduce((n, d) => n + d.count, 0);
  const peak = series.reduce((a, b) => (b.count > a.count ? b : a), series[0]!);

  return (
    <div className="panel panel-lit p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="label">{title}</h3>
        <span className="font-mono text-[0.95rem] font-bold tabular-nums">
          {total.toLocaleString()}
        </span>
      </div>

      <div className="mt-4 flex h-24 items-end gap-[3px]">
        {series.map((d) => (
          <div
            key={d.day}
            className="group relative flex-1 rounded-t-[3px] transition-opacity hover:opacity-80"
            title={`${d.day}: ${d.count}`}
            style={{
              height: d.count === 0 ? "3px" : `${(d.count / max) * 100}%`,
              minHeight: d.count > 0 ? "6px" : undefined,
              background: d.count === 0 ? "var(--color-surface-3)" : color,
            }}
          />
        ))}
      </div>

      <div
        className="mt-2.5 flex items-baseline justify-between font-mono text-[0.6rem]"
        style={{ color: "var(--color-ink-ghost)" }}
      >
        <span>{series[0]?.day.slice(5)}</span>
        {peak.count > 0 && <span>peak {peak.count}</span>}
        <span>{series[series.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}
