import type { WebSocket } from "ws";
import type {
  AvatarColor,
  AvatarId,
  Language,
  PresenceStatus,
  Side,
  SubmissionStatus,
} from "@repo/protocol";

/**
 * A live client connection attached to a battle. One user may briefly have two
 * (reconnect races); the room keys presence by userId, not by socket.
 */
export interface Connection {
  ws: WebSocket;
  userId: string;
  username: string;
  /**
   * Display identity beyond the handle, resolved at handshake time.
   *
   * NOT read from the JWT: tokens only carry id and username, and a player who
   * changes their name, avatar or photo mid-session would otherwise keep
   * showing the old one until their token was re-minted. The DB is the source
   * of truth for everything cosmetic.
   */
  name: string | null;
  avatarId: AvatarId;
  avatarColor: AvatarColor;
  imageUrl: string | null;
  battleId: string;
  /** last app-level ping we received, epoch ms — for idle eviction */
  lastSeen: number;
  /** true once the hello handshake has completed */
  authed: boolean;
}

/** A player's seat + readiness in the lobby (authoritative in-memory copy). */
export interface LobbySeat {
  userId: string;
  username: string;
  name: string | null;
  avatarId: AvatarId;
  avatarColor: AvatarColor;
  imageUrl: string | null;
  side: Side | null;
  slot: number | null;
  ready: boolean;
  presence: PresenceStatus;
}

/**
 * A submission tracked in the room. Mirrors the DB row but lives in memory for
 * fast win-resolution. `submittedAt` is the server-received epoch ms — the sole
 * tie-break authority.
 */
export interface RoomSubmission {
  submissionId: string;
  userId: string;
  side: Side;
  language: Language;
  status: SubmissionStatus;
  passed: number;
  total: number;
  timeMs: number;
  errorMessage: string | null;
  submittedAt: number;
}
