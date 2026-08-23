"use client";

import {
  AVATAR_IDS,
  AVATAR_COLORS,
  type AvatarChoice,
  type AvatarColor,
  type AvatarId,
} from "@repo/protocol";
import { Avatar } from "./Avatar";
import { SPRITE_NAMES } from "./sprites";

/**
 * The character picker: 24 characters over 8 background colours.
 *
 * A controlled component — it owns no state, so the same picker serves guest
 * sign-up (where the choice is sent with the auth request) and settings (where
 * it PATCHes an existing profile).
 */
export function AvatarPicker({
  avatarId,
  color,
  onChange,
  onShuffle,
}: {
  avatarId: AvatarId;
  color: AvatarColor;
  onChange: (next: AvatarChoice) => void;
  /** Optional randomise button, shown next to the heading when provided. */
  onShuffle?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="label">Picture</span>
          {onShuffle && (
            <button
              type="button"
              onClick={onShuffle}
              title="Randomise"
              className="transition-opacity hover:opacity-70"
              style={{ color: "var(--color-accent)" }}
            >
              <IconShuffle />
            </button>
          )}
        </div>

        <div className="grid grid-cols-8 gap-1.5">
          {AVATAR_IDS.map((id) => {
            const selected = id === avatarId;
            return (
              <button
                key={id}
                type="button"
                title={SPRITE_NAMES[id]}
                aria-pressed={selected}
                onClick={() => onChange({ avatarId: id, avatarColor: color })}
                className="rounded-[6px] p-0.5 transition-transform hover:scale-110"
                style={{
                  boxShadow: selected
                    ? "0 0 0 2px var(--color-primary)"
                    : undefined,
                }}
              >
                <Avatar avatarId={id} color={color} size={30} rounded={5} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="label">Color</span>
        <div className="grid grid-cols-8 gap-1.5">
          {AVATAR_COLORS.map((c) => {
            const selected = c === color;
            return (
              <button
                key={c}
                type="button"
                aria-label={`Background ${c}`}
                aria-pressed={selected}
                onClick={() => onChange({ avatarId, avatarColor: c })}
                className="rounded-[6px] p-0.5 transition-transform hover:scale-110"
                style={{
                  boxShadow: selected
                    ? "0 0 0 2px var(--color-primary)"
                    : undefined,
                }}
              >
                {/* Preview the *current* character on each colour, so the
                    swatch shows exactly what picking it would produce. */}
                <Avatar avatarId={avatarId} color={c} size={30} rounded={5} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function IconShuffle() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 4h3l6 8h3M2 12h3l6-8h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M12 2l2 2-2 2M12 10l2 2-2 2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
