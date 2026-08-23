import type { Side } from "@repo/protocol";
import { Avatar } from "../avatar/Avatar";
import { TestChevrons } from "../battle/TestChevrons";
import type { AvatarId } from "@repo/protocol";

/**
 * A duelling code panel — the blue "you" / orange "opponent" cards from the
 * hero. Static display only: the code is a token list, not a live editor.
 *
 * Tokens are pre-classified rather than syntax-highlighted at runtime, because
 * this is fixed marketing copy and shipping a highlighter for two snippets
 * would cost more than the snippets themselves.
 */

export type Tok = [cls: TokClass, text: string];
type TokClass = "kw" | "fn" | "str" | "num" | "op" | "com" | "id" | "pl";

const TOKEN_COLOR: Record<TokClass, string> = {
  kw: "#c678dd", // keyword — purple
  fn: "#61afef", // function / method — blue
  str: "#98c379", // string — green
  num: "#d19a66", // number — orange
  op: "#56b6c2", // operator — cyan
  com: "#5c6370", // comment — grey
  id: "#e06c75", // identifier — red
  pl: "#abb2bf", // plain
};

export function CodePanel({
  side,
  playerName,
  avatarId,
  avatarColor,
  passed,
  total,
  lines,
  startLine = 1,
  runtime,
  language,
  className,
}: {
  side: Side;
  playerName: string;
  avatarId: AvatarId;
  avatarColor: string;
  passed: number;
  total: number;
  /** Each entry is one source line, as a list of classified tokens. */
  lines: Tok[][];
  startLine?: number;
  runtime: string;
  language: string;
  className?: string;
}) {
  const color = side === "A" ? "var(--color-side-a)" : "var(--color-side-b)";
  // Side B mirrors: name and avatar swap to the right, meter to the left.
  const mirrored = side === "B";

  return (
    <div
      className={`panel-side overflow-hidden ${className ?? ""}`}
      style={{ ["--side-color" as string]: color }}
    >
      {/* Header: identity on one end, live test meter on the other. */}
      <div
        className="flex items-center gap-3 px-3 py-2"
        style={{ background: "var(--color-surface-2)" }}
      >
        {mirrored ? (
          <>
            <TestChevrons
              side={side}
              passed={passed}
              total={total}
              reverse
            />
            <span
              className="ml-auto truncate font-mono text-[0.85rem] font-bold"
              style={{ color }}
            >
              {playerName}
            </span>
            <Avatar
              avatarId={avatarId}
              color={avatarColor}
              size={26}
              rounded={5}
            />
          </>
        ) : (
          <>
            <Avatar
              avatarId={avatarId}
              color={avatarColor}
              size={26}
              rounded={5}
            />
            <span
              className="truncate font-mono text-[0.85rem] font-bold"
              style={{ color }}
            >
              {playerName}
            </span>
            <div className="ml-auto">
              <TestChevrons side={side} passed={passed} total={total} />
            </div>
          </>
        )}
      </div>

      {/* Source */}
      <div
        className="overflow-x-auto px-2 py-3 font-mono text-[0.72rem] leading-[1.75]"
        style={{ background: "#14161c" }}
      >
        <pre className="min-w-max">
          <code>
            {lines.map((toks, i) => (
              <div key={i} className="flex gap-3">
                <span
                  className="w-6 shrink-0 select-none text-right tabular-nums"
                  style={{ color: "var(--color-ink-ghost)" }}
                >
                  {startLine + i}
                </span>
                <span>
                  {toks.map(([cls, text], j) => (
                    <span key={j} style={{ color: TOKEN_COLOR[cls] }}>
                      {text}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>

      {/* Status bar */}
      <div
        className="flex items-center gap-3 px-3 py-1.5 font-mono text-[0.6rem]"
        style={{
          background: "var(--color-surface-2)",
          color: "var(--color-ink-faint)",
        }}
      >
        <span>{startLine}:1</span>
        <span>{runtime}</span>
        <span>{language}</span>
      </div>
    </div>
  );
}
