"use client";

import type { ReactNode } from "react";

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
      className="flex items-start gap-2.5 rounded-[9px] border px-3.5 py-2.5 font-mono text-[0.75rem] leading-relaxed"
      style={{
        borderColor: "color-mix(in srgb, var(--color-bad) 45%, transparent)",
        background: "color-mix(in srgb, var(--color-bad) 10%, transparent)",
        color: "var(--color-bad)",
      }}
      role="alert"
    >
      <IconAlert />
      <span>{message}</span>
    </p>
  );
}

/**
 * A headline figure.
 *
 * `accent` tints the top rule, the icon and the hover glow, so a scan down the
 * dashboard groups by colour before anyone reads a label.
 */
export function Stat({
  label,
  value,
  sub,
  accent = "var(--color-primary)",
  icon,
  live = false,
  className = "",
}: {
  label: string;
  value: string | number;
  sub?: ReactNode;
  accent?: string;
  icon?: ReactNode;
  /** Shows a pulsing dot — for figures that change without a reload. */
  live?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`stat ${className}`}
      style={{ "--stat-accent": accent } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="label">{label}</p>
        {icon && (
          <span className="shrink-0" style={{ color: accent, opacity: 0.75 }}>
            {icon}
          </span>
        )}
      </div>

      <p className="stat-value mt-2 flex items-center gap-2">
        {live && <span className="live-dot shrink-0" aria-hidden />}
        {value}
      </p>

      {sub && (
        <p
          className="mt-1 font-mono text-[0.68rem] leading-relaxed"
          style={{ color: "var(--color-ink-faint)" }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/** A page's eyebrow + title block. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="label">{eyebrow}</p>
        <h1 className="grad-text mt-1.5 text-[1.75rem] font-bold leading-none">
          {title}
        </h1>
        {lede && (
          <p
            className="mt-2.5 max-w-2xl font-mono text-[0.76rem] leading-relaxed"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {lede}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2.5">{actions}</div>}
    </div>
  );
}

/** A tinted pill. */
export function Chip({
  children,
  color,
}: {
  children: ReactNode;
  color?: string;
}) {
  if (!color) return <span className="chip">{children}</span>;
  return (
    <span
      className="chip chip-tint"
      style={{ "--chip-color": color } as React.CSSProperties}
    >
      {children}
    </span>
  );
}

/** Muted text for empty cells. */
export function Dim({ children }: { children: ReactNode }) {
  return <span style={{ color: "var(--color-ink-ghost)" }}>{children}</span>;
}

/** What a table shows when it has nothing to show. */
export function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center">
        <span style={{ color: "var(--color-ink-ghost)" }}>{children}</span>
      </td>
    </tr>
  );
}

/* --- icons: drawn inline, no icon package --------------------------------- */

const ICON = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconUsers() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
    </svg>
  );
}

export function IconSwords() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="m13 19 6-6M16 16l4 4M19 21l2-2" />
      <path d="M9.5 17.5 21 6V3h-3L6.5 14.5" />
    </svg>
  );
}

export function IconPulse() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export function IconEye() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconDoc() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

export function IconClock() {
  return (
    <svg {...ICON} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconUpload() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      <path d="M12 3v13M7 8l5-5 5 5" />
    </svg>
  );
}

export function IconGhost() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M5 21V9a7 7 0 0 1 14 0v12l-3-2-2 2-2-2-2 2-2-2Z" />
      <path d="M9.5 10h.01M14.5 10h.01" />
    </svg>
  );
}

export function IconAlert() {
  return (
    <svg {...ICON} width={14} height={14} className="mt-px shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg {...ICON} width={14} height={14} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconPencil() {
  return (
    <svg {...ICON} width={14} height={14} aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconTrash() {
  return (
    <svg {...ICON} width={14} height={14} aria-hidden>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconPlus() {
  return (
    <svg {...ICON} width={14} height={14} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
