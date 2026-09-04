"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LeagueVisibility } from "@repo/protocol";
import { AppShell } from "../../../components/AppShell";
import { SignInGate } from "../../../components/SignInGate";
import { ErrorBanner, Spinner } from "../../../components/atoms";
import {
  BackToLeagues,
  LeagueLogo,
} from "../../../components/leagues/LeagueBits";
import { ApiCallError, createLeague } from "../../../lib/api";
import { fileToAvatarDataUrl, ImageError } from "../../../lib/image";
import { useSession } from "../../../lib/useSession";
import { useProfile } from "../../../lib/useProfile";

/**
 * Creating a league.
 *
 * WHY TEAM SIZE IS PROMINENT AND IRREVERSIBLE
 * -------------------------------------------
 * It is the one setting that cannot be changed afterwards, because teams form
 * against it: lowering it would leave rosters over-sized and raising it would
 * make full teams silently incomplete. So it is a set of large buttons with
 * the consequence spelled out, rather than a dropdown someone skims past.
 *
 * Everything else here is editable later, which is why nothing else carries a
 * warning.
 */
export default function NewLeaguePage() {
  const { session, loaded } = useSession();
  const { profile } = useProfile(session);
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teamSize, setTeamSize] = useState(1);
  const [visibility, setVisibility] = useState<LeagueVisibility>("PUBLIC");
  const [capped, setCapped] = useState(false);
  const [maxTeams, setMaxTeams] = useState(8);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      // Same downscale the profile photo uses — see lib/image.ts for why the
      // image is stored inline rather than in an object store.
      setLogoUrl(await fileToAvatarDataUrl(file));
    } catch (e) {
      setError(
        e instanceof ImageError ? e.message : "Could not read that image.",
      );
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const league = await createLeague(session.token, {
        name: name.trim(),
        description: description.trim(),
        logoUrl,
        visibility,
        teamSize,
        maxTeams: capped ? maxTeams : null,
      });
      router.push(`/leagues/${league.id}`);
    } catch (err) {
      setError(
        err instanceof ApiCallError
          ? err.message
          : "Could not create the league.",
      );
      setBusy(false);
    }
  }

  const canSubmit = name.trim().length >= 3 && !busy;

  return (
    <AppShell session={session} profile={profile}>
      <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-7">
        <BackToLeagues />
        <h1 className="mt-2 text-2xl font-bold">Create a league</h1>

        {!loaded ? null : !session || session.isGuest ? (
          <SignInGate what="create a league" guest={!!session?.isGuest} />
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
            {/* --- identity --- */}
            <section className="panel p-5">
              <h2 className="text-[0.95rem] font-bold">Identity</h2>

              <div className="mt-4 flex items-start gap-4">
                <LeagueLogo name={name || "?"} logoUrl={logoUrl} size={64} />
                <div className="flex flex-col gap-2">
                  <label className="btn btn-ghost cursor-pointer px-3! py-1.5! text-[0.72rem]!">
                    {logoUrl ? "Change logo" : "Upload a logo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void pickLogo(e.target.files?.[0])}
                    />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      className="font-mono text-[0.68rem] underline"
                      style={{ color: "var(--color-ink-faint)" }}
                      onClick={() => setLogoUrl(null)}
                    >
                      Remove
                    </button>
                  )}
                  <p
                    className="font-mono text-[0.64rem]"
                    style={{ color: "var(--color-ink-ghost)" }}
                  >
                    Square works best. Optional.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-1.5">
                <label htmlFor="league-name" className="label">
                  League name
                </label>
                <input
                  id="league-name"
                  className="field"
                  value={name}
                  maxLength={60}
                  placeholder="Spring Invitational"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="mt-4 flex flex-col gap-1.5">
                <label htmlFor="league-desc" className="label">
                  Description
                </label>
                <textarea
                  id="league-desc"
                  className="field min-h-24 py-2"
                  value={description}
                  maxLength={2000}
                  placeholder="Who it's for, when it runs, anything competitors should know."
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </section>

            {/* --- format --- */}
            <section className="panel p-5">
              <h2 className="text-[0.95rem] font-bold">Format</h2>
              <p
                className="mt-1 font-mono text-[0.7rem]"
                style={{ color: "var(--color-warn)" }}
              >
                Team size cannot be changed once the league exists — teams form
                against it.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTeamSize(n)}
                    className="flex flex-col items-center rounded-[8px] border px-3 py-3 transition-colors"
                    style={{
                      borderColor:
                        teamSize === n
                          ? "var(--color-primary)"
                          : "var(--color-line)",
                      background:
                        teamSize === n
                          ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                          : "transparent",
                    }}
                  >
                    <span
                      className="text-[1.05rem] font-bold"
                      style={{
                        color:
                          teamSize === n
                            ? "var(--color-accent)"
                            : "var(--color-ink)",
                      }}
                    >
                      {n}v{n}
                    </span>
                    <span
                      className="mt-0.5 font-mono text-[0.62rem]"
                      style={{ color: "var(--color-ink-faint)" }}
                    >
                      {n === 1 ? "solo" : `${n} per team`}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* --- access --- */}
            <section className="panel p-5">
              <h2 className="text-[0.95rem] font-bold">Who can join</h2>

              <div className="mt-4 flex flex-col gap-2">
                <AccessOption
                  active={visibility === "PUBLIC"}
                  onClick={() => setVisibility("PUBLIC")}
                  title="Public"
                  blurb="Listed on the leagues page. Anyone can form a team and join."
                />
                <AccessOption
                  active={visibility === "PRIVATE"}
                  onClick={() => setVisibility("PRIVATE")}
                  title="Invite only"
                  blurb="Unlisted. Only people you give the join code to can get in."
                />
              </div>

              <label className="mt-5 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={capped}
                  onChange={(e) => setCapped(e.target.checked)}
                />
                <span className="font-mono text-[0.76rem]">
                  Limit how many teams can register
                </span>
              </label>

              {capped && (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="number"
                    className="field w-28"
                    min={2}
                    max={256}
                    value={maxTeams}
                    onChange={(e) =>
                      setMaxTeams(
                        Math.max(2, Math.min(256, Number(e.target.value) || 2)),
                      )
                    }
                  />
                  <span
                    className="font-mono text-[0.7rem]"
                    style={{ color: "var(--color-ink-faint)" }}
                  >
                    teams maximum
                  </span>
                </div>
              )}
            </section>

            {error && <ErrorBanner message={error} />}

            <div className="flex flex-wrap gap-2.5">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!canSubmit}
              >
                {busy ? <Spinner /> : "Create league"}
              </button>
              <Link href="/leagues" className="btn btn-ghost">
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}

function AccessOption({
  active,
  onClick,
  title,
  blurb,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  blurb: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[8px] border px-4 py-3 text-left transition-colors"
      style={{
        borderColor: active ? "var(--color-primary)" : "var(--color-line)",
        background: active
          ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
          : "transparent",
      }}
    >
      <span
        className="text-[0.86rem] font-bold"
        style={{ color: active ? "var(--color-accent)" : "var(--color-ink)" }}
      >
        {title}
      </span>
      <p
        className="mt-1 font-mono text-[0.68rem] leading-[1.6]"
        style={{ color: "var(--color-ink-dim)" }}
      >
        {blurb}
      </p>
    </button>
  );
}
