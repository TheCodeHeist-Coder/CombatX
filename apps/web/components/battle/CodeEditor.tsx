"use client";

import { useMemo, useRef, type ChangeEvent, type KeyboardEvent } from "react";

/**
 * A lean, dependency-free code editor: a monospace textarea with a synced
 * line-number gutter and tab-to-indent. Deliberately not a full IDE — the
 * point is to write a short solution, not live in it. Syntax highlighting and
 * heavier editors are intentionally avoided to keep the surface calm and fast.
 */
export function CodeEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const lineCount = useMemo(() => value.split("\n").length, [value]);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
  }

  function handleScroll() {
    if (gutterRef.current && taRef.current) {
      gutterRef.current.scrollTop = taRef.current.scrollTop;
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.slice(0, start) + "    " + value.slice(end);
      onChange(next);
      // Restore caret after the inserted spaces on next tick.
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 4;
      });
    }
  }

  return (
    <div
      className="flex min-h-0 flex-1 overflow-hidden rounded-[10px] border font-mono text-[0.85rem] leading-[1.6]"
      style={{ borderColor: "var(--color-line)", background: "var(--color-surface-3)" }}
    >
      <div
        ref={gutterRef}
        aria-hidden
        className="select-none overflow-hidden py-3 pl-3 pr-2 text-right"
        style={{ color: "var(--color-ink-faint)", background: "var(--color-surface)" }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        className="flex-1 resize-none bg-transparent px-3 py-3 leading-[1.6] outline-none disabled:opacity-60"
        style={{ color: "var(--color-ink)", tabSize: 4 }}
        placeholder="Write your solution…"
      />
    </div>
  );
}
