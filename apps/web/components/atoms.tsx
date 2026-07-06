import type { ReactNode } from "react";
import type { Side } from "@repo/protocol";

/** A hairline-bordered content shell used as the page container. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
      {children}
    </main>
  );
}

/** Small pill showing a battle's side, tinted by team color. */
export function SideBadge({ side }: { side: Side }) {
  const color = side === "A" ? "var(--color-side-a)" : "var(--color-side-b)";
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[0.7rem] font-semibold"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      {side}
    </span>
  );
}

/** A labeled stat block. */
export function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <span
        className="text-2xl font-semibold tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

/** Full-bleed centered spinner/message for loading states. */
export function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      {children}
    </div>
  );
}

/** A minimal indeterminate dot-spinner. */
export function Spinner() {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full pulse-soft"
          style={{
            background: "var(--color-ink-dim)",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </span>
  );
}

/** Inline error banner. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-[10px] border px-3.5 py-2.5 text-sm"
      style={{
        color: "var(--color-bad)",
        borderColor: "color-mix(in srgb, var(--color-bad) 35%, transparent)",
        background: "color-mix(in srgb, var(--color-bad) 10%, transparent)",
      }}
    >
      {message}
    </div>
  );
}
