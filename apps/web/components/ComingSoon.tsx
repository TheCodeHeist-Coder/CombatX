"use client";

import Link from "next/link";
import { AppShell } from "./AppShell";
import { useSession } from "../lib/useSession";
import { useProfile } from "../lib/useProfile";

/**
 * A placeholder for a destination that is in the navigation but not built.
 *
 * It states plainly that the feature does not exist yet and lists what it will
 * hold. Showing a convincing-looking screen full of invented data would be
 * worse than an empty one — anyone demoing the app would think it worked.
 */
export function ComingSoon({
  title,
  code,
  summary,
  planned,
}: {
  title: string;
  code: string;
  summary: string;
  planned: string[];
}) {
  const { session } = useSession();
  const { profile } = useProfile(session);

  return (
    <AppShell session={session} profile={profile}>
      <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-7">
        <p className="eyebrow">{code}</p>
        <h1 className="mt-2 wordmark text-2xl font-bold uppercase tracking-wide">
          {title}
        </h1>

        <div
          className="panel mt-6 p-5"
          style={{ background: "var(--color-surface-2)" }}
        >
          <span className="chip chip-live">Not_implemented</span>
          <p
            className="mt-3 font-mono text-[0.82rem] leading-relaxed"
            style={{ color: "var(--color-ink-dim)" }}
          >
            {summary}
          </p>
        </div>

        <h2 className="label mt-8">Planned capability</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {planned.map((p) => (
            <li
              key={p}
              className="flex gap-2.5 font-mono text-[0.8rem] leading-relaxed"
              style={{ color: "var(--color-ink-dim)" }}
            >
              <span style={{ color: "var(--color-line-strong)" }}>▹</span>
              {p}
            </li>
          ))}
        </ul>

        <div className="mt-9">
          <Link href="/" className="btn btn-primary">
            ⇤ Return_to_lobby
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
