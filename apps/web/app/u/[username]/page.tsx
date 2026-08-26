"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { PROFILE_LINKS, type PublicProfileResponse } from "@repo/protocol";
import { AppShell } from "../../../components/AppShell";
import { ErrorBanner, Spinner } from "../../../components/atoms";
import { UserAvatar } from "../../../components/identity/UserIdentity";
import { fetchPublicProfile, ApiCallError } from "../../../lib/api";
import { useSession } from "../../../lib/useSession";
import { useProfile } from "../../../lib/useProfile";

/**
 * Someone else's profile page.
 *
 * The server decides what is visible: a private profile 404s for everyone but
 * its owner, so this page never has to reason about who may see what — it
 * renders whatever came back, or a not-found.
 */
export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const { session, loaded } = useSession();
  const { profile: myProfile } = useProfile(session);

  const [data, setData] = useState<PublicProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    // Wait for the session to load: fetching first would 404 your own private
    // profile, then silently succeed on a retry once the token appeared.
    if (!loaded) return;
    let alive = true;
    setError(null);
    setMissing(false);

    fetchPublicProfile(username, session?.token)
      .then((p) => alive && setData(p))
      .catch((err) => {
        if (!alive) return;
        if (err instanceof ApiCallError && err.status === 404) {
          setMissing(true);
        } else {
          setError(
            err instanceof ApiCallError ? err.message : "Could not load that profile.",
          );
        }
      });

    return () => {
      alive = false;
    };
  }, [username, session?.token, loaded]);

  const isMe = !!data && data.userId === session?.userId;

  return (
    <AppShell session={session} profile={myProfile} rail>
      <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-7">
        {missing ? (
          <NotFound username={username} />
        ) : error ? (
          <ErrorBanner message={error} />
        ) : !data ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            <header className="flex items-start gap-4">
              <UserAvatar identity={data} size={80} rounded={14} />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-bold">
                  {data.username}
                </h1>
                {data.name && (
                  <p
                    className="mt-0.5 truncate font-mono text-[0.85rem]"
                    style={{ color: "var(--color-ink-faint)" }}
                  >
                    {data.name}
                  </p>
                )}
                <p
                  className="mt-1.5 font-mono text-[0.7rem]"
                  style={{ color: "var(--color-ink-ghost)" }}
                >
                  Joined {formatJoined(data.joinedAt)}
                </p>
              </div>
              {isMe && (
                <Link href="/settings" className="btn btn-ghost shrink-0">
                  Edit
                </Link>
              )}
            </header>

            {isMe && (
              <p
                className="mt-4 rounded-[8px] border px-3 py-2 font-mono text-[0.72rem]"
                style={{
                  borderColor: "var(--color-line-strong)",
                  background: "var(--color-surface-2)",
                  color: "var(--color-ink-faint)",
                }}
              >
                This is how your profile looks to others.
              </p>
            )}

            {data.bio && (
              <section className="panel mt-6 p-5">
                <h2 className="text-base font-bold">About</h2>
                <p className="mt-2 text-[0.88rem] leading-relaxed whitespace-pre-wrap">
                  {data.bio}
                </p>
              </section>
            )}

            <Links profile={data} />

            <section className="panel mt-4 p-5">
              <h2 className="text-base font-bold">Record</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="XP" value={data.xp} />
                <Stat label="Wins" value={data.wins} />
                <Stat label="Losses" value={data.losses} />
                <Stat label="Best streak" value={data.bestStreak} />
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

/**
 * The links row, omitted entirely when the profile carries none.
 *
 * Built from PROFILE_LINKS so a new site appears here the moment it is added
 * to the table. Each href comes from that table's pattern applied to a stored
 * bare handle, so a profile field can never point somewhere unexpected. The
 * website is the one real URL, and the server restricts it to http(s).
 */
function Links({ profile }: { profile: PublicProfileResponse }) {
  const links: { label: string; text: string; href: string }[] = [];

  for (const link of PROFILE_LINKS) {
    const handle = profile[link.key];
    if (handle) {
      links.push({
        label: link.label,
        text: link.display(handle),
        href: link.url(handle),
      });
    }
  }
  if (profile.website) {
    links.push({
      label: "Website",
      text: profile.website.replace(/^https?:\/\//i, ""),
      href: profile.website,
    });
  }

  if (links.length === 0) return null;

  return (
    <section className="panel mt-4 p-5">
      <h2 className="text-base font-bold">Links</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.label} className="flex items-baseline gap-3">
            <span className="label w-24 shrink-0">{l.label}</span>
            <a
              href={l.href}
              target="_blank"
              // noreferrer as well as noopener: these are user-supplied links,
              // and the destination has no business seeing where the click
              // came from.
              rel="noopener noreferrer nofollow"
              className="truncate font-mono text-[0.82rem] underline underline-offset-2"
              style={{ color: "var(--color-accent)" }}
            >
              {l.text}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NotFound({ username }: { username: string }) {
  return (
    <div className="panel p-8 text-center">
      <h1 className="text-xl font-bold">Profile not available</h1>
      <p
        className="mx-auto mt-2 max-w-sm font-mono text-[0.8rem] leading-relaxed"
        style={{ color: "var(--color-ink-faint)" }}
      >
        No public profile for{" "}
        <span style={{ color: "var(--color-ink-dim)" }}>{username}</span>. It
        may not exist, or its owner keeps it private.
      </p>
      <Link href="/rankings" className="btn btn-ghost mt-5">
        Back to rankings
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-[8px] border-l-2 px-3 py-2.5"
      style={{
        borderColor: "var(--color-primary)",
        background: "var(--color-surface-3)",
      }}
    >
      <p className="label">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

/** "March 2026" — a join month, without pretending to a precise day. */
function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}
