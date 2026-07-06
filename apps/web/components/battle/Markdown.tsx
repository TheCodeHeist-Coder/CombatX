import { Fragment, type ReactNode } from "react";

/**
 * A deliberately tiny, dependency-free Markdown renderer for problem
 * statements. Renders to React nodes (never raw HTML), so it's XSS-safe by
 * construction. Supports: #/##/### headings, fenced ``` code blocks, `-`/`*`
 * bullet lists, blank-line paragraphs, and inline **bold** / `code`.
 */
export function Markdown({ source }: { source: string }) {
  return <div className="md flex flex-col gap-3">{renderBlocks(source)}</div>;
}

function renderBlocks(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // Fenced code block.
    if (line.trim().startsWith("```")) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      i += 1; // closing fence
      out.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded-[10px] border p-3 font-mono text-[0.85rem] leading-relaxed"
          style={{ background: "var(--color-surface-3)", borderColor: "var(--color-line)" }}
        >
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Headings.
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      const text = heading[2] ?? "";
      const cls =
        level === 1
          ? "text-lg font-semibold"
          : level === 2
            ? "text-base font-semibold"
            : "text-sm font-semibold";
      out.push(
        <p key={key++} className={cls}>
          {renderInline(text)}
        </p>,
      );
      i += 1;
      continue;
    }

    // Bullet list.
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      out.push(
        <ul key={key++} className="ml-4 flex list-disc flex-col gap-1 text-sm">
          {items.map((it, idx) => (
            <li key={idx} style={{ color: "var(--color-ink-dim)" }}>
              {renderInline(it)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Blank line.
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Paragraph (gather consecutive non-blank, non-special lines).
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !/^\s*[-*]\s+/.test(lines[i] ?? "") &&
      !/^(#{1,3})\s+/.test(lines[i] ?? "") &&
      !(lines[i] ?? "").trim().startsWith("```")
    ) {
      para.push(lines[i] ?? "");
      i += 1;
    }
    out.push(
      <p
        key={key++}
        className="text-sm leading-relaxed"
        style={{ color: "var(--color-ink-dim)" }}
      >
        {renderInline(para.join(" "))}
      </p>,
    );
  }

  return out;
}

/** Inline: **bold** and `code`. */
function renderInline(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} style={{ color: "var(--color-ink)" }}>
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={key++}
          className="rounded px-1 py-0.5 font-mono text-[0.85em]"
          style={{ background: "var(--color-surface-3)", color: "var(--color-ink)" }}
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <Fragment>{nodes}</Fragment>;
}
