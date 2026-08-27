"use client";

import { useRouter } from "next/navigation";
import { Spinner } from "../components/atoms";
import { AppShell } from "../components/AppShell";
import { HeroGate } from "../components/landing/HeroGate";
import { RosterSection } from "../components/landing/RosterSection";
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
        onEnterBattle={(id) => router.push(`/battle/${id}`)}
      />
      <HowItWorks />
      <RosterSection />
      <Languages />
      <Inception />
      <DeployPanel loaded={loaded} session={session} />
    </AppShell>
  );
}

/* --- 1. Hero -------------------------------------------------------------- */

function Hero({
  loaded,
  session,
  onEnterBattle,
}: {
  loaded: boolean;
  session: ReturnType<typeof useSession>["session"];
  onEnterBattle: (id: string) => void;
}) {
  return (
    <section id="play" className="relative overflow-hidden">
      <div className="relative mx-auto w-full max-w-6xl px-5 pb-0 pt-16 sm:px-7 sm:pt-20">
        {/* Wordmark */}
        <h1 className="rise wordmark grad-text text-center text-[clamp(2.5rem,10vw,8rem)]">
          Code Battle
        </h1>

        <p
          className="rise rise-1 mx-auto mt-6 max-w-xl text-center font-mono tracking-wider  text-[0.82rem] leading-[1.9] sm:text-[0.9rem]"
          style={{ color: "var(--color-ink-dim)" }}
        >
          A thrilling arena for coders who crave competition and fun. Unleash
          your programming skills in real-time battles against friends and
          fellow developers, all while tackling unique AI-generated challenges
        </p>

        {/*
          A three-column band: fighter, launcher, fighter. A grid rather than
          absolute positioning, so the artwork and the captions can never sit
          on top of each other however tall the launcher or wide the art gets.
          Below xl the fighter columns collapse and the launcher stands alone.

          `items-stretch` (the grid default) rather than `items-end`: the side
          columns then inherit the row's full height, which is set by whichever
          launcher is showing. The fighters size to that instead of to a fixed
          height, so they stand full-length beside a short sign-in card and a
          tall create-battle card alike.

          The row must END at the tallest column, or the bottom-anchored
          fighters float above the panels below. So the breathing room under
          the launcher is margin on the CARD inside the centre column, not
          padding on the column itself — padding there would grow the row and
          lift the fighters off the panels again.
        */}
        <div className="relative z-10 mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem_minmax(0,1fr)]">
          {/* Left: you */}
          <div className="relative hidden h-full items-end justify-center xl:flex">
            <HeroFighter
              side="left"
              className="h-full max-h-[34rem] min-h-80 w-full max-w-60 mr-15"
            />
          </div>

          {/* Centre: create or join a battle without leaving the hero. */}
          <div className="rise rise-2 mx-auto w-full max-w-md">
            <div
              className="panel mb-10 p-8 text-left"
              style={{ boxShadow: "var(--shadow-lift)" }}
            >
              {!loaded ? (
                <div className="flex h-36 items-center justify-center">
                  <Spinner />
                </div>
              ) : session ? (
                <Launcher session={session} onEnterBattle={onEnterBattle} />
              ) : (
                <HeroGate onReady={onEnterBattle} />
              )}
            </div>
          </div>

          {/* Right: the rival */}
          <div className="relative hidden h-full items-end justify-center xl:flex">
            <HeroFighter
              side="right"
              className="h-full max-h-[34rem] min-h-80 w-full max-w-60 ml-18"
            />
          </div>
        </div>

        <div className="relative ">
          {/* The duelling panels. */}
          <div className="rise rise-3  mx-auto grid max-w-6xl gap-8 pb-16 lg:grid-cols-2">
            <CodePanel
              side="A"
              playerName="Mysterious Fox"
              avatarId="frog"
              avatarColor="#2e8b6b"
              passed={28}
              total={50}
              lines={JS_LINES}
              startLine={7}
              runtime="Node.js 24.6.1 LTS"
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



/* --- 2. How it works ------------------------------------------------------ */

function HowItWorks() {
  return (
    <section>
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
    title: "System generates a coding task",
    body: "That's why every fight has a new challenge. Tasks are solved from 3 to 20 minutes",
    icon: <IconChip />,
  },
  {
    title: "See who can solve the problem faster",
    body: "Whoever completes all the test cases first takes the win. During coding, you see your friend's code, which makes it more fun",
    icon: <IconClock />,
  },
  {
    title: "Get matched with a random coder",
    body: "Coming soon: hit one button and we pair you with another developer looking for a fight right now. No room codes, no waiting on friends — just an instant opponent",
    icon: <IconMatchmaking />,
  },
] as const;

/* --- 3. Languages ---------------------------------------------------------- */

function Languages() {
  return (
    <section>
      {/* Languages */}
      <div className="mx-auto w-full max-w-4xl px-5 py-20 text-center sm:px-7">
        <h2 className="grad-text wordmark text-[clamp(2rem,5.5vw,3.2rem)]">
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
          <a href="#play" className="btn btn-primary px-12! py-4! text-[0.86rem]!">
            Start
          </a>
        </div>
      </div>
    </section>
  );
}

const LANGUAGES = [
  "Javascript", "Python", "Java", "C ++", "Go", "TypeScript", "Scala", "Rust", "Elixir", "Dart",
] as const;

/* --- 4. Inception --------------------------------------------------------- */

function Inception() {
  return (
    <section>
      <div className="mx-auto w-full max-w-4xl px-5 py-20 text-center sm:px-7">
        <div className="flex items-center justify-center gap-6">
          <ChevronCluster color="var(--color-side-a)" />
          <h2 className="grad-text wordmark text-[clamp(2.8rem,8vw,5rem)]">
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
}: {
  loaded: boolean;
  session: ReturnType<typeof useSession>["session"];
}) {
  const router = useRouter();

  return (
    <section id="deploy" className="px-5 py-20 sm:px-7">
      <div className="mx-auto w-full max-w-4xl text-center">
        <p className="eyebrow" style={{ color: "var(--color-ink-faint)" }}>
          The rules of engagement
        </p>

        {/* Flanked the way the Inception heading is, so the two closing
            sections read as a pair rather than as unrelated blocks. */}
        <div className="mt-3 flex items-center justify-center gap-6">
          <ChevronCluster color="var(--color-side-a)" />
          <h2 className="wordmark grad-text text-[clamp(2.2rem,6vw,3.4rem)]">
            Enter the arena
          </h2>
          <ChevronCluster color="var(--color-side-b)" reverse />
        </div>

        <p
          className="mx-auto mt-4 max-w-xl font-mono text-[0.82rem] leading-relaxed"
          style={{ color: "var(--color-ink-dim)" }}
        >
          Every battle is judged the same way, for everyone, every time.
        </p>

        {/*
          The rules of a fight, not another launcher — the hero already carries
          one, and repeating it here made the page end on a form it had already
          shown. These four are the promises the server actually keeps.

          Each card takes its side's colour through --rule-color, so the
          blue/orange pairing that runs through the whole arena reads here too.
        */}
        <div className="mt-12 grid gap-4 text-left sm:grid-cols-2">
          {ARENA_RULES.map((rule, i) => (
            <article
              key={rule.title}
              className={`rule-card rise rise-${i + 1}`}
              style={{ "--rule-color": rule.accent } as React.CSSProperties}
            >
              <div className="flex items-start gap-4">
                <span className="rule-index shrink-0" aria-hidden>
                  {rule.tag}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[1rem] font-bold leading-snug">
                    {rule.title}
                  </h3>
                  <p
                    className="mt-2 font-mono text-[0.75rem] leading-[1.85]"
                    style={{ color: "var(--color-ink-dim)" }}
                  >
                    {rule.body}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* A hairline that fades in from both sides, separating the rules
            from the call to action without a hard full-width border. */}
        <div
          className="mx-auto mt-14 h-px w-full max-w-md"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--color-line-strong), transparent)",
          }}
        />

        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            className="btn btn-primary px-12! py-4! text-[0.86rem]!"
            onClick={() => {
              // Signed in, straight to the arena; otherwise sign up first and
              // land there afterwards. Either way this is a route, not a form
              // duplicated from the hero.
              router.push(session ? "/arena" : "/signup?next=%2Farena");
            }}
            disabled={!loaded}
          >
            {session ? "Go to the arena" : "Create your account"}
          </button>
          <p
            className="font-mono text-[0.72rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {session ? (
              "Host a battle or join one with a room code."
            ) : (
              <>
                Got a room code?{" "}
                <a
                  href="#play"
                  className="underline underline-offset-2"
                  style={{ color: "var(--color-accent)" }}
                >
                  Jump in without an account
                </a>
                .
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * What the server guarantees during a battle.
 *
 * Deliberately concrete — each line describes behaviour that is actually
 * enforced in code (the sandbox, the hidden-source rule, the tie-break, the
 * post-match reveal) rather than marketing copy nothing backs up.
 */
const ARENA_RULES = [
  {
    tag: "01",
    accent: "var(--color-side-a)",
    title: "Same problem, same tests",
    body: "Both sides get an identical task and an identical hidden test suite. Nobody draws an easier draw.",
  },
  {
    tag: "02",
    accent: "var(--color-side-b)",
    title: "Your code stays yours",
    body: "During the fight your opponent sees your pass-count and nothing else. The source itself is never sent.",
  },
  {
    tag: "03",
    accent: "var(--color-side-a)",
    title: "First to pass everything wins",
    body: "Ties break on who submitted earlier, decided by the server clock rather than whoever's connection was quicker.",
  },
  {
    tag: "04",
    accent: "var(--color-side-b)",
    title: "Read the winning solution",
    body: "When it's over both solutions unlock side by side, so a loss is worth as much as a win.",
  },
] as const;

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
        &lt;/&gt;
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

/** Decorative sparkle positions around the matchmaking icon. */
const SPARKLES = [
  { x: 9, y: 12 },
  { x: 111, y: 16 },
  { x: 100, y: 76 },
  { x: 14, y: 82 },
] as const;

/**
 * Two strangers paired for a duel, under a "coming soon" plate.
 *
 * Blue on the left, orange on the right — the same side colours the arena
 * uses — with a VS between them and a search sweep around the pair.
 */
function IconMatchmaking() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden>
      {/* The pairing sweep: a dashed ring that reads as "searching". */}
      <circle
        cx="60"
        cy="62"
        r="27"
        stroke="var(--color-line-strong)"
        strokeWidth="1.5"
        strokeDasharray="4 5"
        opacity="0.8"
      />

      {/* Left player — you. */}
      <circle cx="38" cy="56" r="7" fill="var(--color-side-a)" />
      <path
        d="M27 78c0-6.5 4.9-11 11-11s11 4.5 11 11z"
        fill="var(--color-side-a)"
        opacity="0.85"
      />

      {/* Right player — the stranger you get matched with. */}
      <circle cx="82" cy="56" r="7" fill="var(--color-side-b)" />
      <path
        d="M71 78c0-6.5 4.9-11 11-11s11 4.5 11 11z"
        fill="var(--color-side-b)"
        opacity="0.85"
      />

      {/* VS */}
      <text
        x="60"
        y="72"
        textAnchor="middle"
        fill="var(--color-ink-dim)"
        style={{ font: "800 13px var(--font-mono)" }}
      >
        VS
      </text>

      <rect
        x="14"
        y="14"
        width="92"
        height="27"
        rx="6"
        fill="#14161c"
        stroke="var(--color-primary)"
        strokeWidth="2"
      />
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
