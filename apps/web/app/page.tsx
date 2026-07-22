"use client";

import { useRouter } from "next/navigation";
import { Spinner } from "../components/atoms";
import { AppShell } from "../components/AppShell";
import { GuestGate } from "../components/GuestGate";
import { Launcher } from "../components/Launcher";
import { useSession } from "../lib/useSession";
import { useProfile } from "../lib/useProfile";
import { clearSession } from "../lib/session";

export default function HomePage() {
  const { session, loaded, refresh } = useSession();
  const { profile } = useProfile(session);
  const router = useRouter();

  return (
    <AppShell
      session={session}
      profile={profile}
      rail={!!session}
      right={
        session ? (
          <button
            className="btn btn-ghost px-3! py-1.5! text-[0.68rem]!"
            onClick={() => {
              clearSession();
              refresh();
            }}
          >
            Sign out
          </button>
        ) : (
          <span className="label hidden sm:inline">Recon</span>
        )
      }
    >
      {/* --- Hero ------------------------------------------------------- */}
      <section className="border-b" style={{ borderColor: "var(--color-line)" }}>
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-7 lg:grid-cols-[1fr_1fr] lg:items-center lg:py-20">
          <div className="rise">
            <span className="chip chip-live">
              <span
                className="ping-ring relative inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: "var(--color-accent)",
                  color: "var(--color-accent)",
                }}
              />
              System status: operational // secure
            </span>

            <h1
              className="mt-6 text-[2.1rem] font-semibold leading-[1.1] sm:text-[2.7rem]"
              style={{ letterSpacing: "-0.02em" }}
            >
              The master class
              <br />
              in{" "}
              <em
                className="not-italic"
                style={{ color: "var(--color-accent)" }}
              >
                competitive logic.
              </em>
            </h1>

            <p
              className="mt-5 max-w-md font-mono text-[0.86rem] leading-relaxed"
              style={{ color: "var(--color-ink-dim)" }}
            >
              Elite-level architecture for developers who treat code as
              weaponry. CombatX provides a rigorous, server-authoritative
              environment for head-to-head tactical programming.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#deploy" className="btn btn-primary">
                Quick_start_init
              </a>
              <a href="#protocol-01" className="btn btn-ghost">
                Read_documentation
              </a>
            </div>
          </div>

          <div className="rise rise-2">
            <BootTerminal />
          </div>
        </div>
      </section>

      {/* --- Protocol 01: the gap --------------------------------------- */}
      <section
        id="protocol-01"
        className="border-b"
        style={{
          borderColor: "var(--color-line)",
          background: "var(--color-blush)",
        }}
      >
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-7">
          <p className="eyebrow">Protocol 01</p>
          <h2 className="mt-2 font-mono text-sm font-bold uppercase tracking-wider">
            The head-to-head gap
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PILLARS.map((p) => (
              <article key={p.title} className="panel step-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-mono text-[0.8rem] font-bold uppercase tracking-wide">
                    {p.title}
                  </h3>
                  <span style={{ color: "var(--color-line-strong)" }}>
                    {p.icon}
                  </span>
                </div>
                <p
                  className="mt-3 font-mono text-[0.78rem] leading-relaxed"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  {p.body}
                </p>
                <p
                  className="mt-4 font-mono text-[0.6rem] uppercase tracking-widest"
                  style={{ color: "var(--color-accent)" }}
                >
                  {p.tag}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* --- Protocol 02: architecture ---------------------------------- */}
      <section className="border-b" style={{ borderColor: "var(--color-line)" }}>
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-7 lg:grid-cols-2 lg:items-center">
          <ArchitectureDiagram />

          <div>
            <p className="eyebrow">Protocol 02</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
              Server-authoritative
              <br />
              architecture
            </h2>
            <p
              className="mt-4 font-mono text-[0.84rem] leading-relaxed"
              style={{ color: "var(--color-ink-dim)" }}
            >
              CombatX eliminates client-side bias. Every contestable fact —
              readiness, submission time, score, outcome — is decided by the
              server. Clients send intent; they never assert results.
            </p>

            <ul className="mt-6 flex flex-col gap-3">
              {GUARANTEES.map((g) => (
                <li key={g} className="flex gap-2.5">
                  <span
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--color-accent)" }}
                  >
                    <IconCheck />
                  </span>
                  <span
                    className="font-mono text-[0.8rem] leading-relaxed"
                    style={{ color: "var(--color-ink-dim)" }}
                  >
                    {g}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* --- Deploy / action panel -------------------------------------- */}
      <section
        id="deploy"
        style={{ background: "var(--color-primary)" }}
        className="px-5 py-16 sm:px-7"
      >
        <div className="mx-auto w-full max-w-2xl text-center">
          <h2
            className="font-mono text-sm font-bold uppercase leading-relaxed tracking-[0.2em]"
            style={{ color: "var(--color-sand)" }}
          >
            Are you ready
            <br />
            to deploy?
          </h2>
          <p
            className="mt-5 font-mono text-[0.82rem]"
            style={{ color: "color-mix(in srgb, var(--color-sand) 70%, transparent)" }}
          >
            Pick a callsign, share a room code, and test your limits in the
            Arena. No account required.
          </p>

          <div className="mx-auto mt-8 max-w-md text-left">
            <div
              className="border p-5"
              style={{
                borderColor: "color-mix(in srgb, var(--color-sand) 30%, transparent)",
                background: "color-mix(in srgb, #000 12%, transparent)",
              }}
            >
              {!loaded ? (
                <div className="flex h-36 items-center justify-center">
                  <Spinner />
                </div>
              ) : session ? (
                <Launcher
                  session={session}
                  onEnterBattle={(id) => router.push(`/battle/${id}`)}
                  onDark
                />
              ) : (
                <GuestGate onReady={refresh} onDark />
              )}
            </div>
          </div>

          <p
            className="mt-6 font-mono text-[0.6rem] uppercase tracking-[0.2em]"
            style={{ color: "color-mix(in srgb, var(--color-sand) 45%, transparent)" }}
          >
            System_version: 7.4.1 // recruitment_phase: active
          </p>
        </div>
      </section>
    </AppShell>
  );
}

/* --- pieces --------------------------------------------------------------- */

const PILLARS = [
  {
    title: "Latency rejection",
    body: "The server stamps every submission on receipt. Network jitter cannot buy you a tie-break, and it cannot cost you one either.",
    tag: "Active_mitigation_on",
    icon: <IconTrend />,
  },
  {
    title: "Hidden test cases",
    body: "Tests live in the database and are read only by the judge. You see how many passed — never which, never the inputs.",
    tag: "Resource_lock_engaged",
    icon: <IconLock />,
  },
  {
    title: "Zero-trust execution",
    body: "Every submission runs in an isolated Piston sandbox with hard timeouts and truncated output. Your machine is never the runtime.",
    tag: "Kernel_monitor_ready",
    icon: <IconEye />,
  },
] as const;

const GUARANTEES = [
  "Readiness, scoring, and outcome are computed by pure, unit-tested rules on the server.",
  "Submission receipt time is the sole tie-break authority — no client clock is trusted.",
  "Problem selection is seeded by battle ID, so both sides provably get the same problem.",
] as const;

/** The boot log from the hero. Static text — it documents a real build. */
function BootTerminal() {
  const lines = [
    ["operative@combatx:~$", "docker compose up --build"],
    ["[+]", "Building 0.4s (12/12) FINISHED"],
    ["=>", "[internal] load build definition from Dockerfile"],
    ["=>", "[internal] load .dockerignore"],
    ["=>", "[auth-srv] spawning high-latency simulation ..."],
    ["SUCCESS", "Arena environment initialized."],
  ];

  return (
    <div className="terminal" style={{ boxShadow: "var(--shadow-lift)" }}>
      <div className="terminal-bar">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: "var(--color-accent)" }}
        />
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: "var(--color-amber)" }}
        />
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: "var(--color-line-strong)" }}
        />
        <span className="label ml-auto">SH-V8 // Terminal</span>
      </div>
      <div className="overflow-x-auto p-4">
        {lines.map(([prefix, rest], i) => (
          <div key={i} className="flex gap-3 whitespace-nowrap">
            <span
              className="select-none tabular-nums"
              style={{ color: "var(--color-line-strong)" }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>
              <span style={{ color: "var(--color-accent)" }}>{prefix}</span>{" "}
              <span style={{ color: "var(--color-ink-dim)" }}>{rest}</span>
            </span>
          </div>
        ))}
        <div className="flex gap-3">
          <span
            className="select-none tabular-nums"
            style={{ color: "var(--color-line-strong)" }}
          >
            07
          </span>
          <span style={{ color: "var(--color-accent)" }}>
            operative@combatx:~${" "}
            <span className="caret" style={{ color: "var(--color-ink)" }}>
              _
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Two clients, one authoritative hub. Pure CSS/SVG, no image asset. */
function ArchitectureDiagram() {
  return (
    <div
      className="relative border p-6"
      style={{
        borderColor: "var(--color-line-strong)",
        background: "var(--color-surface-2)",
        minHeight: "20rem",
      }}
    >
      <div className="flex justify-between">
        <span className="chip">Operative_client</span>
        <span className="chip">Operative_client</span>
      </div>

      <div className="my-8 flex justify-center">
        <div
          className="grid h-32 w-32 place-items-center rounded-full border border-dashed"
          style={{ borderColor: "var(--color-accent)" }}
        >
          <div
            className="grid h-20 w-20 place-items-center px-2 text-center"
            style={{
              background: "var(--color-primary)",
              color: "var(--color-sand)",
            }}
          >
            <span className="font-mono text-[0.55rem] uppercase leading-tight tracking-wider">
              Central_command
              <br />
              Authoritative_hub
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <span className="chip">State_consensus_engine</span>
      </div>
    </div>
  );
}

function IconCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" />
      <path d="M5.2 8.2l2 2 3.6-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrend() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M1.5 11.5l4-4 3 3 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 4.5h4v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="7" stroke="currentColor" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke="currentColor" />
      <circle cx="8" cy="8" r="1.8" stroke="currentColor" />
    </svg>
  );
}
