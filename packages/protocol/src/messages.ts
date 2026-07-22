import { z } from "zod";
import {
  BattleConfig,
  BattleSnapshot,
  PlayerView,
  ProgressionAward,
  PublicProblem,
  SideProgress,
  StandingRow,
  SubmissionResultView,
} from "./domain.js";
import {
  FinishReason,
  Language,
  PresenceStatus,
  Side,
} from "./enums.js";

/**
 * Wire protocol for the raw-`ws` transport (no Socket.IO).
 *
 * Every frame is JSON: `{ t: <type>, ... }`.
 *
 * Request/response is correlated with a `reqId`: a client REQUEST carries a
 * `reqId`, and the server answers with an `ack` (or `ack-error`) echoing it.
 * Everything else is a fire-and-forget EVENT (server -> client broadcast).
 */

// ---------------------------------------------------------------------------
// Client -> Server: requests (expect an ack) and intents
// ---------------------------------------------------------------------------

/** Sent once right after the socket opens: authenticate + attach to a battle. */
export const HelloReq = z.object({
  t: z.literal("hello"),
  reqId: z.string(),
  /** guest JWT issued by http-api */
  token: z.string(),
  /** which battle this connection is for */
  battleId: z.string(),
});

export const JoinTeamReq = z.object({
  t: z.literal("team:select"),
  reqId: z.string(),
  side: Side,
  slot: z.number().int().nonnegative(),
});

export const ReadyReq = z.object({
  t: z.literal("player:ready"),
  reqId: z.string(),
  ready: z.boolean(),
});

/** Host-only: start the battle (server validates readiness + host). */
export const StartReq = z.object({
  t: z.literal("battle:start"),
  reqId: z.string(),
});

export const SubmitReq = z.object({
  t: z.literal("code:submit"),
  reqId: z.string(),
  language: Language,
  source: z.string().max(100_000),
});

export const LeaveReq = z.object({
  t: z.literal("battle:leave"),
  reqId: z.string(),
});

/** Lightweight app-level heartbeat (in addition to ws ping/pong frames). */
export const PingReq = z.object({
  t: z.literal("ping"),
  reqId: z.string(),
  clientTime: z.number(),
});

export const ClientMessage = z.discriminatedUnion("t", [
  HelloReq,
  JoinTeamReq,
  ReadyReq,
  StartReq,
  SubmitReq,
  LeaveReq,
  PingReq,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ---------------------------------------------------------------------------
// Server -> Client: acks (correlated) and events (broadcast)
// ---------------------------------------------------------------------------

/** Generic success ack. `data` shape depends on which request it answers. */
export const Ack = z.object({
  t: z.literal("ack"),
  reqId: z.string(),
  data: z.unknown().optional(),
});

export const AckError = z.object({
  t: z.literal("ack-error"),
  reqId: z.string(),
  code: z.string(),
  message: z.string(),
});

/** Answer to a `ping` — carries server time for clock-offset estimation. */
export const Pong = z.object({
  t: z.literal("pong"),
  reqId: z.string(),
  clientTime: z.number(),
  serverTime: z.number(),
});

/** Full lobby/battle snapshot. Sent on hello-ack and on any structural change. */
export const SnapshotEvent = z.object({
  t: z.literal("snapshot"),
  snapshot: BattleSnapshot,
});

/** Lightweight lobby delta (roster / ready / config changed). */
export const LobbyUpdateEvent = z.object({
  t: z.literal("lobby:update"),
  players: z.array(PlayerView),
  config: BattleConfig,
});

export const CountdownEvent = z.object({
  t: z.literal("battle:countdown"),
  startsInMs: z.number().int().nonnegative(),
});

/** The problem is revealed here — identically to both sides, at start. */
export const BattleStartEvent = z.object({
  t: z.literal("battle:start"),
  problem: PublicProblem,
  serverStartAt: z.number(),
  serverEndAt: z.number(),
  serverNowMs: z.number(),
});

/** ~1/sec authoritative clock correction. Client timers are cosmetic. */
export const TimerTickEvent = z.object({
  t: z.literal("timer:tick"),
  serverNowMs: z.number(),
  endAtMs: z.number(),
});

export const SubmissionQueuedEvent = z.object({
  t: z.literal("submission:queued"),
  submissionId: z.string(),
  userId: z.string(),
  side: Side,
});

/** Judge verdict. The ONLY progress signal opponents receive (no source). */
export const SubmissionResultEvent = z.object({
  t: z.literal("submission:result"),
  result: SubmissionResultView,
});

/** Convenience derived event: best passed-count per side. */
export const ProgressEvent = z.object({
  t: z.literal("opponent:progress"),
  progress: z.array(SideProgress),
});

export const PresenceEvent = z.object({
  t: z.literal("presence:update"),
  userId: z.string(),
  status: PresenceStatus,
});

export const BattleFinishedEvent = z.object({
  t: z.literal("battle:finished"),
  winnerSide: Side.nullable(),
  reason: FinishReason,
  standings: z.array(StandingRow),
  decidingSubmissionId: z.string().nullable(),
  /**
   * What each seated player earned. Safe to broadcast: XP totals are not
   * secret, and no source code or test data is carried here.
   */
  awards: z.array(ProgressionAward).default([]),
});

/** Out-of-band error not tied to a specific request. */
export const ServerErrorEvent = z.object({
  t: z.literal("error"),
  code: z.string(),
  message: z.string(),
});

export const ServerMessage = z.discriminatedUnion("t", [
  Ack,
  AckError,
  Pong,
  SnapshotEvent,
  LobbyUpdateEvent,
  CountdownEvent,
  BattleStartEvent,
  TimerTickEvent,
  SubmissionQueuedEvent,
  SubmissionResultEvent,
  ProgressEvent,
  PresenceEvent,
  BattleFinishedEvent,
  ServerErrorEvent,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

// ---------------------------------------------------------------------------
// Ack payload shapes (data field of specific acks)
// ---------------------------------------------------------------------------

/** data returned by the hello-ack: the initial snapshot + your identity. */
export const HelloAckData = z.object({
  userId: z.string(),
  snapshot: BattleSnapshot,
});
export type HelloAckData = z.infer<typeof HelloAckData>;

/** data returned by the submit-ack. */
export const SubmitAckData = z.object({
  submissionId: z.string(),
});
export type SubmitAckData = z.infer<typeof SubmitAckData>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse & validate a raw inbound client frame. Throws on invalid. */
export function parseClientMessage(raw: string): ClientMessage {
  return ClientMessage.parse(JSON.parse(raw));
}

/** Parse & validate a raw inbound server frame. Throws on invalid. */
export function parseServerMessage(raw: string): ServerMessage {
  return ServerMessage.parse(JSON.parse(raw));
}

/** Serialize any server message for the wire. */
export function encode(msg: ServerMessage | ClientMessage): string {
  return JSON.stringify(msg);
}
