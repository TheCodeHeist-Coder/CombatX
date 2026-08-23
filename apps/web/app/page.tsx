"use client";

import { useRouter } from "next/navigation";
import { Spinner } from "../components/atoms";
import { AppShell } from "../components/AppShell";
import { GuestGate } from "../components/GuestGate";
import { Launcher } from "../components/Launcher";
import { HeroFighter } from "../components/landing/HeroFighters";
import { CodePanel } from "../components/landing/CodePanel";
import { JS_LINES, GO_LINES } from "../components/landing/demoCode";
import { useSession } from "../lib/useSession";
import { useProfile } from "../lib/useProfile";
import { clearSession } from "../lib/session";

/**
 * The landing page: hero duel, how-it-works, live stats, languages, and the
 * deploy panel. Signed-in visitors get the Launcher in place of the guest gate
 * so the primary CTA always does something useful.
 */
export default function HomePage() {
  const { session, loaded, refresh } = useSession();
  const { profile } = useProfile(session);
  const router = useRouter();

  return (
    <AppShell
      session={session}
      profile={profile}
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
        ) : null
      }
    >
      <Hero
        loaded={loaded}
        session={session}
        refresh={refresh}
        onEnterBattle={(id) => router.push(`/battle/${id}`)}
      />
      <HowItWorks />
      <StatsAndLanguages />
      <Inception />
      <DeployPanel
        loaded={loaded}
        session={session}
        refresh={refresh}
        onEnterBattle={(id) => router.push(`/battle/${id}`)}
      />
    </AppShell>
  );
}

/* --- 1. Hero -------------------------------------------------------------- */

function Hero({
  loaded,
  session,
  refresh,
  onEnterBattle,
}: {
  loaded: boolean;
  session: ReturnType<typeof useSession>["session"];
  refresh: () => void;
  onEnterBattle: (id: string) => void;
}) {
  return (
    <section className="arena-glow relative overflow-hidden">
      <div className="relative mx-auto w-full max-w-6xl px-5 pb-0 pt-16 sm:px-7 sm:pt-20">
        {/* Wordmark */}
        <h1 className="rise display grad-text text-center text-[clamp(2.6rem,9vw,5.5rem)]">
          Code Battle
        </h1>

        <p
          className="rise rise-1 mx-auto mt-6 max-w-xl text-center font-mono text-[0.82rem] leading-[1.9] sm:text-[0.9rem]"
          style={{ color: "var(--color-ink-dim)" }}
        >
          A thrilling arena for coders who crave competition and fun. Unleash
          your programming skills in real-time battles against friends and
          fellow developers, all while tackling unique AI-generated challenges
        </p>

        {/* The launcher sits centre stage with a fighter flanking each side.
            Below xl the figures drop away and the launcher stands alone. */}
        <div className="relative mt-10 min-h-72">
          <HeroFighter
            side="left"
            className="float-y pointer-events-none absolute bottom-0 left-0 hidden h-72 w-52 xl:block"
          />
          <HeroFighter
            side="right"
            className="float-y-slow pointer-events-none absolute bottom-0 right-0 hidden h-72 w-52 xl:block"
          />

          <Annotation className="absolute bottom-16 left-52 hidden 2xl:block" flip>
            It&apos;s you
          </Annotation>
          <Annotation className="absolute bottom-12 right-52 hidden text-right 2xl:block">
            The computer science teacher
            <br />
            who doubted me
            <br />
            <span style={{ opacity: 0.7 }}>if you send him the link</span>
          </Annotation>

          {/* Create or join a battle without leaving the hero. */}
          <div className="rise rise-2 relative mx-auto w-full max-w-md">
            <div className="panel p-6 text-left" style={{ boxShadow: "var(--shadow-lift)" }}>
              {!loaded ? (
                <div className="flex h-36 items-center justify-center">
                  <Spinner />
                </div>
              ) : session ? (
                <Launcher session={session} onEnterBattle={onEnterBattle} />
              ) : (
                <GuestGate onReady={refresh} />
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          {/* The duelling panels. */}
          <div className="rise rise-3 mx-auto mt-10 grid max-w-6xl gap-5 pb-16 lg:grid-cols-2">
            <CodePanel
              side="A"
              playerName="Mysterious Fox"
              avatarId="frog"
              avatarColor="#2e8b6b"
              passed={28}
              total={50}
              lines={JS_LINES}
              startLine={7}
              runtime="Node.js 12 LTS"
              language="JavaScript"
            />
            <CodePanel
              side="B"
              playerName="Galactic Penguin"
              avatarId="penguin"
              avatarColor="#5b4bc4"
              passed={44}
              total={50}
              lines={GO_LINES}
              startLine={12}
              runtime="Go 1.17"
              language="Go"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** The handwritten-style pointer labels from the reference hero. */
function Annotation({
  children,
  className,
  flip = false,
}: {
  children: React.ReactNode;
  className?: string;
  flip?: boolean;
}) {
  return (
    <span
      className={`pointer-events-none font-mono text-[0.7rem] uppercase leading-relaxed tracking-[0.12em] ${className ?? ""}`}
      style={{ color: "var(--color-ink-faint)" }}
    >
      <svg
        width="60"
        height="26"
        viewBox="0 0 60 26"
        fill="none"
        className="mb-1 block"
        style={{ transform: flip ? "scaleX(-1)" : undefined }}
        aria-hidden
      >
        <path
          d="M2 2c6 14 22 21 56 20"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
      {children}
    </span>
  );
}

/* --- 2. How it works ------------------------------------------------------ */

function HowItWorks() {
  return (
    <section className="border-t" style={{ borderColor: "var(--color-line)" }}>
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-7 md:grid-cols-3 md:gap-8">
        {STEPS.map((s) => (
          <article key={s.title} className="flex flex-col items-center text-center">
            <div className="mb-7 h-24">{s.icon}</div>
            <h3 className="max-w-[16rem] text-[1.4rem] font-bold leading-tight">
              {s.title}
            </h3>
            <p
              className="mt-4 max-w-[19rem] font-mono text-[0.78rem] leading-[1.9]"
              style={{ color: "var(--color-ink-dim)" }}
            >
              {s.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "AI generates a coding task",
    body: "That's why every fight has a new challenge. Tasks are solved from 3 to 20 minutes",
    icon: <IconChip />,
  },
  {
    title: "See who can solve the problem faster",
    body: "Whoever completes all the test cases first takes the win. During coding, you see your friend's code, which makes it more fun",
    icon: <IconClock />,
  },
  {
    title: "Earn money on crypto duels",
    body: "This time it's all up to your skills. Make a 50/50 bet with your opponent, and take it all back as the winner",
    icon: <IconCoins />,
  },
] as const;

/* --- 3. Stats + languages ------------------------------------------------- */

function StatsAndLanguages() {
  return (
    <section className="border-t" style={{ borderColor: "var(--color-line)" }}>
      {/* Stats strip */}
      <div
        className="border-b"
        style={{
          borderColor: "var(--color-line)",
          background: "var(--color-surface)",
        }}
      >
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-8 sm:px-7 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
          <div className="grid grid-cols-3 gap-6">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="label">{s.label}</div>
                <div className="grad-text display mt-2 text-[2.4rem] tabular-nums">
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Recent-results ticker */}
          <ul
            className="flex flex-col justify-center gap-2.5 border-l pl-8 max-lg:border-l-0 max-lg:pl-0"
            style={{ borderColor: "var(--color-line)" }}
          >
            {TICKER.map((t, i) => (
              <li
                key={i}
                className="flex gap-4 font-mono text-[0.78rem]"
                style={{ color: "var(--color-ink-dim)" }}
              >
                <span
                  className="w-12 shrink-0 text-right"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  {t.when}
                </span>
                <span>
                  <span style={{ color: "var(--color-accent)" }}>
                    {t.winner}
                  </span>{" "}
                  {t.verb}{" "}
                  <span style={{ color: "var(--color-accent)" }}>
                    {t.loser}
                  </span>
                  {t.time ? ` in ${t.time}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Languages */}
      <div className="mx-auto w-full max-w-4xl px-5 py-20 text-center sm:px-7">
        <h2 className="grad-text display text-[clamp(1.5rem,4vw,2.2rem)]">
          {LANGUAGES.length} Programming Languages
        </h2>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          {LANGUAGES.map((l) => (
            <span key={l} className="lang-pill font-mono">
              {l}
            </span>
          ))}
        </div>

        <div className="mt-12">
          <a href="#deploy" className="btn btn-primary px-12! py-4! text-[0.86rem]!">
            Start
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * Marketing figures for the stats strip.
 *
 * Static on purpose: these are illustrative, and wiring them to a live count
 * would show "0 / 0 / 0" on a fresh database — worse than an honest sample.
 * Swap for a real aggregate endpoint when there is traffic to report.
 */
const STATS = [
  { label: "Tasks generated", value: "338" },
  { label: "Total players", value: "121" },
  { label: "Lines of code", value: "6505" },
] as const;

const TICKER = [
  { when: "30 min", winner: "Zheludkov", verb: "defeated", loser: "Arseniy", time: "5:32" },
  { when: "8 min", winner: "Funky Chicken", verb: "defeated", loser: "Zheludkov Ivan", time: "12:40" },
  { when: "8 min", winner: "Mr Scrubble", verb: "defeated", loser: "Galactic Penguin", time: "15:01" },
  { when: "now", winner: "3 battles", verb: "going on right now", loser: "", time: "" },
] as const;

const LANGUAGES = [
  "Javascript", "Python", "Ruby", "PHP", "C#", "Objective-C", "Swift", "Java",
  "Kotlin", "C ++", "Go", "TypeScript", "Scala", "Rust", "Elixir", "Dart",
] as const;

/* --- 4. Inception --------------------------------------------------------- */

function Inception() {
  return (
    <section
      className="grid-tex border-t"
      style={{ borderColor: "var(--color-line)" }}
    >
      <div className="mx-auto w-full max-w-4xl px-5 py-20 text-center sm:px-7">
        <div className="flex items-center justify-center gap-6">
          <ChevronCluster color="var(--color-side-a)" />
          <h2 className="grad-text display text-[clamp(2rem,6vw,3.4rem)]">
            Inception
          </h2>
          <ChevronCluster color="var(--color-side-b)" reverse />
        </div>

        <p
          className="mx-auto mt-8 max-w-2xl font-mono text-[0.86rem] leading-[1.95] sm:text-[0.95rem]"
          style={{ color: "var(--color-ink-dim)" }}
        >
          Our goal was to create a fun-filled arena where coders can duel it out
          in skill-specific challenges, chit-chat, and put their coding chops
          &mdash; and those of their friends &mdash; to the ultimate test, all
          in the spirit of good fun
        </p>
      </div>
    </section>
  );
}

/** The five-bar cluster flanking the Inception heading. */
function ChevronCluster({
  color,
  reverse = false,
}: {
  color: string;
  reverse?: boolean;
}) {
  // Fades out toward the outer edge, mirroring the reference's decorative run.
  const opacities = [1, 0.85, 0.7, 0.3, 0.18];
  const order = reverse ? [...opacities].reverse() : opacities;

  return (
    <div className="hidden gap-1 sm:flex" aria-hidden>
      {order.map((o, i) => (
        <span
          key={i}
          className="chev"
          style={{ background: color, opacity: o, height: "1.6rem", width: "1.4rem" }}
        />
      ))}
    </div>
  );
}

/* --- 5. Deploy ------------------------------------------------------------ */

function DeployPanel({
  loaded,
  session,
  refresh,
  onEnterBattle,
}: {
  loaded: boolean;
  session: ReturnType<typeof useSession>["session"];
  refresh: () => void;
  onEnterBattle: (id: string) => void;
}) {
  return (
    <section
      id="deploy"
      className="arena-glow border-t px-5 py-20 sm:px-7"
      style={{ borderColor: "var(--color-line)" }}
    >
      <div className="mx-auto w-full max-w-lg text-center">
        <h2 className="display grad-text text-[clamp(1.6rem,5vw,2.4rem)]">
          Enter the arena
        </h2>
        <p
          className="mt-4 font-mono text-[0.82rem] leading-relaxed"
          style={{ color: "var(--color-ink-dim)" }}
        >
          Pick a character, share a room code, and test your limits. No account
          required.
        </p>

        <div className="panel mt-8 p-6 text-left">
          {!loaded ? (
            <div className="flex h-36 items-center justify-center">
              <Spinner />
            </div>
          ) : session ? (
            <Launcher session={session} onEnterBattle={onEnterBattle} />
          ) : (
            <GuestGate onReady={refresh} />
          )}
        </div>
      </div>
    </section>
  );
}

/* --- icons: drawn, not imported ------------------------------------------ */

/** An AI chip on a circuit board. */
function IconChip() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden>
      <g stroke="var(--color-line-strong)" strokeWidth="1.5">
        <path d="M30 18V6M48 18V4M66 18V6M30 78v12M48 78v14M66 78v12M18 30H6M18 48H4M18 66H6M78 30h12M78 48h14M78 66h12" strokeLinecap="round" />
        <circle cx="30" cy="6" r="2.5" fill="var(--color-surface)" />
        <circle cx="66" cy="6" r="2.5" fill="var(--color-surface)" />
        <circle cx="6" cy="30" r="2.5" fill="var(--color-surface)" />
        <circle cx="6" cy="66" r="2.5" fill="var(--color-surface)" />
        <circle cx="90" cy="30" r="2.5" fill="var(--color-surface)" />
        <circle cx="90" cy="66" r="2.5" fill="var(--color-surface)" />
        <circle cx="30" cy="90" r="2.5" fill="var(--color-surface)" />
        <circle cx="66" cy="90" r="2.5" fill="var(--color-surface)" />
      </g>
      <rect x="18" y="18" width="60" height="60" rx="8" fill="var(--color-surface-3)" stroke="var(--color-line-strong)" strokeWidth="2" />
      <text
        x="48"
        y="55"
        textAnchor="middle"
        fill="var(--color-primary)"
        style={{ font: "800 22px var(--font-mono)" }}
      >
        AI
      </text>
    </svg>
  );
}

/** A stopwatch over a keyboard, with the idea bulb. */
function IconClock() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden>
      <rect x="6" y="52" width="72" height="30" rx="5" fill="var(--color-surface-3)" stroke="var(--color-line-strong)" strokeWidth="2" />
      <g fill="var(--color-line-strong)">
        {[0, 1, 2, 3, 4, 5].map((c) =>
          [0, 1, 2].map((r) => (
            <rect key={`${c}-${r}`} x={12 + c * 11} y={58 + r * 8} width="8" height="6" rx="1.5" />
          )),
        )}
      </g>
      <circle cx="60" cy="26" r="19" fill="var(--color-surface-3)" stroke="var(--color-amber)" strokeWidth="2.5" />
      <path d="M60 15v11l7 5" stroke="var(--color-amber)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M54 5h12M60 5V2" stroke="var(--color-amber)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M86 60a6 6 0 10-12 0c0 3 2 4 2 7h8c0-3 2-4 2-7z" fill="var(--color-primary)" opacity="0.9" />
      <path d="M77 71h6" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Decorative sparkle positions around the coins icon. */
const SPARKLES = [
  { x: 9, y: 12 },
  { x: 111, y: 16 },
  { x: 100, y: 76 },
  { x: 14, y: 82 },
] as const;

/** Coins under a "coming soon" plate. */
function IconCoins() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden>
      <circle cx="44" cy="62" r="18" fill="var(--color-amber)" opacity="0.9" />
      <text
        x="44"
        y="70"
        textAnchor="middle"
        fill="#14161c"
        style={{ font: "800 20px var(--font-mono)" }}
      >
        ₿
      </text>
      <circle cx="70" cy="58" r="16" fill="var(--color-side-a)" opacity="0.75" />
      <circle cx="30" cy="46" r="12" fill="var(--color-line-strong)" opacity="0.9" />
      <rect x="14" y="14" width="92" height="27" rx="6" fill="#14161c" stroke="var(--color-primary)" strokeWidth="2" />
      <text
        x="60"
        y="32.5"
        textAnchor="middle"
        fill="var(--color-primary)"
        style={{ font: "800 12px var(--font-mono)", letterSpacing: "0.06em" }}
      >
        COMING SOON
      </text>
      {SPARKLES.map(({ x, y }, i) => (
        <path
          key={i}
          d={`M${x} ${y - 6}l1.6 4.4L${x + 6} ${y}l-4.4 1.6L${x} ${y + 6}l-1.6-4.4L${x - 6} ${y}l4.4-1.6z`}
          fill="var(--color-ink-dim)"
          opacity="0.55"
        />
      ))}
    </svg>
  );
}
