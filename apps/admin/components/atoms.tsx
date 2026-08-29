"use client";

/** A short inline spinner for busy buttons. */
export function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-label="Loading"
    />
  );
}

/** A red banner for a failed action. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      className="rounded-[8px] border px-3 py-2 font-mono text-[0.75rem]"
      style={{
        borderColor: "var(--color-bad)",
        background: "color-mix(in srgb, var(--color-bad) 10%, transparent)",
        color: "var(--color-bad)",
      }}
      role="alert"
    >
      {message}
    </p>
  );
}

/** A headline number with a label and optional sub-line. */
export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-[10px] border-l-2 px-4 py-3"
      style={{
        borderColor: accent ?? "var(--color-primary)",
        background: "var(--color-surface-2)",
      }}
    >
      <p className="label">{label}</p>
      <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">
        {value}
      </p>
      {sub && (
        <p
          className="mt-0.5 font-mono text-[0.68rem]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
