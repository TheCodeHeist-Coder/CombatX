"use client";

import { useRouter } from "next/navigation";
import { Shell } from "../components/atoms";
import { TopBar } from "../components/TopBar";
import { GuestGate } from "../components/GuestGate";
import { Launcher } from "../components/Launcher";
import { useSession } from "../lib/useSession";
import { clearSession } from "../lib/session";

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

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Hero copy */}
          <section className="rise">
            <p
              className="mb-4 text-xs font-medium uppercase tracking-[0.18em]"
              style={{ color: "var(--color-accent)" }}
            >
              Real-time coding battles
            </p>
            <h1
              className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl"
              style={{ letterSpacing: "-0.03em" }}
            >
              Same problem.
              <br />
              <span style={{ color: "var(--color-ink-dim)" }}>
                First to pass
              </span>{" "}
              wins.
            </h1>
            <p
              className="mt-5 max-w-md text-[0.98rem] leading-relaxed"
              style={{ color: "var(--color-ink-dim)" }}
            >
              Face off against an opponent on the same challenge. Solve every
              hidden test first for an instant win — or hold the highest score
              when the clock runs out. You never see their code; they never see
              yours.
            </p>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {[
                "Server-authoritative judging",
                "Hidden tests never leak",
                "1v1 today · up to 4v4 soon",
              ].map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  <span
                    className="h-1 w-1 rounded-full"
                    style={{ background: "var(--color-accent)" }}
                  />
                  {f}
                </li>
              ))}
            </ul>
          </section>

          {/* Action panel */}
          <section
            className="panel rise p-6 sm:p-7"
            style={{ animationDelay: "0.08s" }}
          >
            {!loaded ? (
              <div className="h-40" />
            ) : session ? (
              <Launcher
                session={session}
                onEnterBattle={(id) => router.push(`/battle/${id}`)}
              />
            ) : (
              <GuestGate onReady={refresh} />
            )}
          </section>
        </div>
      </div>

      <footer
        className="mt-10 flex items-center justify-between text-xs"
        style={{ color: "var(--color-ink-faint)" }}
      >
        <span>CombatX</span>
        <span>Solve fast. Solve first.</span>
      </footer>
    </Shell>
  );
}
