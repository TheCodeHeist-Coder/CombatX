"use client";

import { useEffect, useState } from "react";
import type { AdminOverviewResponse, DailyCount } from "@repo/protocol";
import { AdminShell } from "../components/AdminShell";
import { ErrorBanner, Spinner, Stat } from "../components/atoms";
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

  useEffect(() => {
    if (!session) return;
    let alive = true;

    const load = () => {
      fetchOverview(session.token)
        .then((d) => alive && setData(d))
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
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="label">Live</p>
        <h1 className="mt-1 text-2xl font-bold">Overview</h1>
      </div>

      <section>
        <h2 className="label mb-3">Players</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Online now"
            // Null means ws-server did not answer — "—" rather than a
            // confident 0, which would read as "nobody is playing".
            value={data.users.onlineNow ?? "—"}
            sub={
              data.users.onlineNow === null
                ? "ws-server unreachable"
                : "in a live battle room"
            }
            accent="var(--color-good)"
          />
          <Stat
            label="Active today"
            value={data.users.activeToday}
            sub={`${data.users.activeWeek} in the last 7 days`}
          />
          <Stat
            label="Registered"
            value={data.users.registered}
            sub={`+${data.users.signupsToday} today, +${data.users.signupsWeek} this week`}
          />
          <Stat
            label="Guests"
            value={data.users.guests}
            sub={`${data.users.total} rows total`}
            accent="var(--color-ink-faint)"
          />
        </div>
      </section>

      <section>
        <h2 className="label mb-3">Battles</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Total battles"
            value={data.battles.total}
            sub={`${data.battles.finished} finished`}
            accent="var(--color-side-a)"
          />
          <Stat
            label="In progress"
            value={data.battles.inProgress}
            sub="lobby, countdown or running"
            accent="var(--color-warn)"
          />
          <Stat
            label="Today"
            value={data.battles.today}
            sub={`${data.battles.week} this week`}
          />
          <Stat
            label="Submissions"
            value={data.submissions.total}
            sub={`${data.submissions.today} today`}
            accent="var(--color-side-b)"
          />
        </div>
      </section>

      <section>
        <h2 className="label mb-3">Traffic</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Total page views"
            value={data.traffic.totalViews.toLocaleString()}
            sub={`${data.traffic.viewsToday} today`}
          />
          <Stat
            label="Unique visitors"
            value={data.traffic.uniqueVisitors30d.toLocaleString()}
            sub="distinct browsers, 30 days"
          />
          <Stat
            label="Problems"
            value={data.problems.total}
            sub={Object.entries(data.problems.byDifficulty)
              .map(([k, v]) => `${v} ${k.toLowerCase()}`)
              .join(", ")}
          />
        </div>

        {data.traffic.topPaths.length > 0 && (
          <div className="panel mt-3 p-5">
            <h3 className="label">Most visited (30 days)</h3>
            <ul className="mt-3 flex flex-col gap-1.5">
              {data.traffic.topPaths.map((p) => (
                <li
                  key={p.path}
                  className="flex items-baseline justify-between gap-4 font-mono text-[0.78rem]"
                >
                  <span className="truncate">{p.path}</span>
                  <span
                    className="tabular-nums"
                    style={{ color: "var(--color-ink-faint)" }}
                  >
                    {p.count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="label mb-3">Last 14 days</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <Sparkline
            title="Signups"
            series={data.trend.signups}
            color="var(--color-primary)"
          />
          <Sparkline
            title="Battles"
            series={data.trend.battles}
            color="var(--color-side-a)"
          />
          <Sparkline
            title="Page views"
            series={data.trend.views}
            color="var(--color-side-b)"
          />
        </div>
      </section>
    </div>
  );
}

/**
 * A bar chart of one daily series.
 *
 * Bars rather than a line: the values are counts of discrete events, and a
 * line implies a continuous quantity that was sampled. Heights are scaled to
 * the series max, with a floor so a non-zero day is never invisible.
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

  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="label">{title}</h3>
        <span className="font-mono text-[0.78rem] font-bold tabular-nums">
          {total.toLocaleString()}
        </span>
      </div>

      <div className="mt-4 flex h-20 items-end gap-1">
        {series.map((d) => (
          <div
            key={d.day}
            className="flex-1 rounded-t-[2px] transition-opacity hover:opacity-70"
            title={`${d.day}: ${d.count}`}
            style={{
              height: d.count === 0 ? "2px" : `${(d.count / max) * 100}%`,
              minHeight: d.count > 0 ? "4px" : undefined,
              background:
                d.count === 0 ? "var(--color-line-strong)" : color,
            }}
          />
        ))}
      </div>

      <div
        className="mt-2 flex justify-between font-mono text-[0.62rem]"
        style={{ color: "var(--color-ink-ghost)" }}
      >
        <span>{series[0]?.day.slice(5)}</span>
        <span>{series[series.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}
