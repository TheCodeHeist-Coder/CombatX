"use client";

/**
 * Offset pagination for the admin tables.
 *
 * Renders nothing when everything fits on one page, so a small deployment
 * never shows dead controls.
 */
export function Pager({
  offset,
  count,
  total,
  onPage,
  pageSize = 50,
}: {
  offset: number;
  count: number;
  total: number;
  onPage: (next: number) => void;
  pageSize?: number;
}) {
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between">
      <span
        className="font-mono text-[0.72rem]"
        style={{ color: "var(--color-ink-faint)" }}
      >
        {offset + 1}–{offset + count} of {total.toLocaleString()}
      </span>
      <div className="flex gap-2">
        <button
          className="btn btn-ghost"
          disabled={offset === 0}
          onClick={() => onPage(Math.max(0, offset - pageSize))}
        >
          Previous
        </button>
        <button
          className="btn btn-ghost"
          disabled={offset + count >= total}
          onClick={() => onPage(offset + pageSize)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
