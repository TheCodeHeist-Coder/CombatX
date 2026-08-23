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
  displayName: string;
  /**
   * Cosmetic identity, resolved at handshake time.
   *
   * NOT read from the JWT: guest tokens only carry id and name, and a player
   * who changes avatar mid-session would otherwise keep showing the old one
   * until their token was re-minted. The DB is the source of truth.
   */
  avatarId: AvatarId;
  avatarColor: AvatarColor;
  battleId: string;
  /** last app-level ping we received, epoch ms — for idle eviction */
  lastSeen: number;
  /** true once the hello handshake has completed */
  authed: boolean;
}

/** A player's seat + readiness in the lobby (authoritative in-memory copy). */
export interface LobbySeat {
  userId: string;
  displayName: string;
  avatarId: AvatarId;
  avatarColor: AvatarColor;
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
