"use client";

import { useRouter } from "next/navigation";
import { Shell, Spinner } from "../components/atoms";
import { TopBar } from "../components/TopBar";
import { GuestGate } from "../components/GuestGate";
import { Launcher } from "../components/Launcher";
import { useSession } from "../lib/useSession";
import { clearSession } from "../lib/session";

/**
 * Decorative "A vs B" mark floating above the action panel. Purely ornamental —
 * it carries the two team colours into the hero so the page reads as a contest.
 */
function VersusGlyph() {
  return (
    <div
      aria-hidden
      className="float-slow pointer-events-none absolute -top-5 right-4 z-10 hidden select-none items-center gap-2 sm:flex"
    >
      {(
        [
          ["A", "var(--color-side-a)"],
          ["B", "var(--color-side-b)"],
        ] as const
      ).map(([letter, color], i) => (
        <span key={letter} className="flex items-center gap-2">
          {i === 1 && (
            <span
              className="font-mono text-[0.65rem] font-semibold"
              style={{ color: "var(--color-ink-faint)" }}
            >
              VS
            </span>
          )}
          <span
            className="grid h-8 w-8 place-items-center rounded-lg text-sm font-bold"
            style={{
              color,
              background: `color-mix(in srgb, ${color} 15%, var(--color-surface))`,
              border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
              boxShadow: `0 8px 22px -10px ${color}`,
            }}
          >
            {letter}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { session, loaded, refresh } = useSession();
  const router = useRouter();

  return (
    <Shell>
      <TopBar
        session={session}
        right={
          session && (
            <button
              className="chip transition-colors hover:opacity-80"
              onClick={() => {
                clearSession();
                refresh();
              }}
            >
              Sign out
            </button>
          )
        }
      />

      <div className="flex flex-1 flex-col justify-center py-6">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          {/* Hero copy */}
          <section className="rise">
            <span className="chip chip-live mb-5">
              <span
                className="ping-ring relative inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--color-good)", color: "var(--color-good)" }}
              />
              Live · real-time coding battles
            </span>

            <h1
              className="text-[2.6rem] font-semibold leading-[1.04] sm:text-6xl"
              style={{ letterSpacing: "-0.035em" }}
            >
              Same problem.
              <br />
              <span className="text-gradient">First to pass</span> wins.
            </h1>

            <p
              className="mt-6 max-w-md text-[1.02rem] leading-relaxed"
              style={{ color: "var(--color-ink-dim)" }}
            >
              Face off against an opponent on the same challenge. Solve every
              hidden test first for an instant win — or hold the highest score
              when the clock runs out.{" "}
              <span style={{ color: "var(--color-ink)" }}>
                You never see their code; they never see yours.
              </span>
            </p>

            <ul className="mt-8 grid gap-2.5 text-sm sm:grid-cols-2">
              {[
                ["⚔️", "Head-to-head, one clock"],
                ["🔒", "Hidden tests never leak"],
                ["⚡", "Instant win on all-pass"],
                ["🎯", "1v1 today · 4v4 soon"],
              ].map(([icon, text]) => (
                <li
                  key={text}
                  className="flex items-center gap-2.5"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  <span
                    aria-hidden
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[0.72rem]"
                    style={{
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-line)",
                    }}
                  >
                    {icon}
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </section>

          {/* Action panel */}
          <section className="relative">
            <VersusGlyph />
            <div className="panel panel-lift rise rise-2 p-6 sm:p-7">
              {!loaded ? (
                <div className="flex h-44 items-center justify-center">
                  <Spinner />
                </div>
              ) : session ? (
                <Launcher
                  session={session}
                  onEnterBattle={(id) => router.push(`/battle/${id}`)}
                />
              ) : (
                <GuestGate onReady={refresh} />
              )}
            </div>
          </section>
        </div>

        {/* How a battle runs — three beats, so a first-timer knows the shape. */}
        <ol className="rise rise-3 mt-12 grid gap-3 sm:grid-cols-3 lg:mt-16">
          {(
            [
              [
                "01",
                "Share a code",
                "Create a room, send the six-character code. No signup.",
                "var(--color-side-a)",
              ],
              [
                "02",
                "Seat up & ready",
                "Both sides pick a team and ready up. The host starts it.",
                "var(--color-accent-hot)",
              ],
              [
                "03",
                "Race the clock",
                "Same problem, hidden tests. First to pass them all wins.",
                "var(--color-side-b)",
              ],
            ] as const
          ).map(([n, title, body, color]) => (
            <li key={n} className="panel step-card p-4 sm:p-5">
              <span
                className="font-mono text-[0.7rem] font-semibold tracking-widest"
                style={{ color }}
              >
                {n}
              </span>
              <h3 className="mt-2 text-[0.95rem] font-semibold">{title}</h3>
              <p
                className="mt-1.5 text-[0.85rem] leading-relaxed"
                style={{ color: "var(--color-ink-faint)" }}
              >
                {body}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <footer
        className="mt-8 flex items-center justify-between border-t pt-5 text-xs"
        style={{
          color: "var(--color-ink-faint)",
          borderColor: "var(--color-line)",
        }}
      >
        <span>CombatX</span>
        <span className="font-mono tracking-tight">Solve fast. Solve first.</span>
      </footer>
    </Shell>
  );
}
