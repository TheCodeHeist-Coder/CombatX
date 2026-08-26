"use client";

import Link from "next/link";
import type { AvatarColor, AvatarId } from "@repo/protocol";
import { Avatar } from "../avatar/Avatar";

/** The identity fields every surface needs to render a player. */
export interface IdentityLike {
  username: string;
  name?: string | null;
  avatarId: AvatarId;
  avatarColor: AvatarColor;
  imageUrl?: string | null;
}

/**
 * A player's face: uploaded photo when they have one, pixel character when
 * they don't.
 *
 * The photo is a plain <img> rather than next/image because it is a user
 * upload from an arbitrary origin — next/image would need every such host
 * whitelisted in next.config, and would fail closed on any that wasn't.
 */
export function UserAvatar({
  identity,
  size = 36,
  rounded = 6,
  ring,
}: {
  identity: IdentityLike;
  size?: number;
  rounded?: number;
  /** Team-colored outline, matching the pixel Avatar's own ring prop. */
  ring?: string;
}) {
  if (identity.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={identity.imageUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-cover"
        style={{
          borderRadius: rounded,
          width: size,
          height: size,
          boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
        }}
      />
    );
  }
  return (
    <Avatar
      avatarId={identity.avatarId}
      color={identity.avatarColor}
      size={size}
      rounded={rounded}
      ring={ring}
    />
  );
}

/**
 * Username with the real name beneath it, smaller and dimmer.
 *
 * The name row is omitted entirely when unset rather than reserving space for
 * it, so a roster of handle-only players stays vertically even.
 */
export function UserIdentity({
  identity,
  size = 36,
  className = "",
  usernameClassName = "text-[0.85rem] font-semibold",
}: {
  identity: IdentityLike;
  size?: number;
  className?: string;
  usernameClassName?: string;
}) {
  return (
    <span className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <UserAvatar identity={identity} size={size} />
      <NameStack
        identity={identity}
        usernameClassName={usernameClassName}
      />
    </span>
  );
}

/** The text half of an identity, for callers that place their own avatar. */
export function NameStack({
  identity,
  usernameClassName = "text-[0.85rem] font-semibold",
}: {
  identity: IdentityLike;
  usernameClassName?: string;
}) {
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className={`truncate ${usernameClassName}`}>
        {identity.username}
      </span>
      {identity.name && (
        <span
          className="truncate font-mono text-[0.68rem]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          {identity.name}
        </span>
      )}
    </span>
  );
}

/**
 * Wraps an identity in a link to its public profile.
 *
 * Always renders a link, even though a private profile will answer with a
 * not-found page. Whether an account is public is not something a viewer is
 * entitled to know up front — hiding the link would leak exactly the fact the
 * privacy setting exists to keep, by making private accounts visibly
 * un-clickable in every roster.
 */
export function ProfileLink({
  username,
  className = "",
  children,
}: {
  username: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/u/${encodeURIComponent(username)}`}
      className={`transition-opacity hover:opacity-80 ${className}`}
      title={`View ${username}'s profile`}
    >
      {children}
    </Link>
  );
}
