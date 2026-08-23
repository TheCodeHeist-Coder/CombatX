import type { Side } from "@repo/protocol";

/**
 * The parallelogram test-case meter.
 *
 * Five skewed bars that fill as a side clears tests, plus the percentage. This
 * is the one signal you get about the opponent — never their pass/fail detail,
 * just how far along they are.
 *
 * Side B's bars fill from the right so the two meters mirror each other across
 * the arena, exactly as in the reference layout.
 */
export function TestChevrons({
  side,
  passed,
  total,
  reverse = false,
  bars = 5,
}: {
  side: Side;
  passed: number;
  total: number;
  /** Render bars right-to-left (used for the opponent's mirrored panel). */
  reverse?: boolean;
  bars?: number;
}) {
  const color =
    side === "A" ? "var(--color-side-a)" : "var(--color-side-b)";
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  // Bars are a coarse read of the same percentage — with 5 bars each one is
  // worth 20%, and a partially-cleared bar counts as lit so any progress shows.
  const lit = Math.ceil((pct / 100) * bars);

  const meter = (
    <div className="flex gap-[3px]" aria-hidden>
      {Array.from({ length: bars }, (_, i) => {
        // Mirrored panels light up from the outside in.
        const index = reverse ? bars - 1 - i : i;
        return (
          <span
            key={i}
            className={`chev${index < lit ? " chev-on" : ""}`}
            style={{ ["--chev-on" as string]: color }}
          />
        );
      })}
    </div>
  );

  const readout = (
    <div className={reverse ? "text-left" : "text-right"}>
      <div
        className="font-mono text-[0.8rem] font-bold leading-none tabular-nums"
        style={{ color }}
      >
        {pct}%
      </div>
      <div
        className="mt-0.5 font-mono text-[0.5rem] uppercase tracking-[0.14em]"
        style={{ color: "var(--color-ink-faint)" }}
      >
        Test-cases
      </div>
    </div>
  );

  return (
    <div
      className="flex items-center gap-2"
      role="progressbar"
      aria-valuenow={passed}
      aria-valuemin={0}
      aria-valuemax={total || 1}
      aria-label={`Team ${side} progress: ${passed} of ${total} tests`}
    >
      {reverse ? (
        <>
          {meter}
          {readout}
        </>
      ) : (
        <>
          {readout}
          {meter}
        </>
      )}
    </div>
  );
}
