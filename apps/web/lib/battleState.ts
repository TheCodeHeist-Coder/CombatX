import type {
  ProgressionAward,
  BattleSnapshot,
  PublicProblem,
  ServerMessage,
  Side,
  SideProgress,
  SubmissionResultView,
} from "@repo/protocol";

/**
 * A client-only synthetic action the connection dispatches once, right after
 * the hello-ack, to seed our own identity + initial snapshot. It never travels
 * over the wire, so it lives alongside (not inside) the protocol union.
 */
export interface HelloAction {
  t: "@hello";
  userId: string;
  snapshot: BattleSnapshot;
}

export type BattleAction = ServerMessage | HelloAction;

/**
 * The client's local mirror of a battle, derived purely from server messages.
 * The server is authoritative; this is a projection we render from. Timers here
 * are cosmetic and corrected by `timer:tick` (see endAtMs / serverClockSkewMs).
 */
export interface BattleState {
  /** null until the hello-ack lands. */
  snapshot: BattleSnapshot | null;
  /** who "I" am, from the hello-ack. */
  myUserId: string | null;
  /** revealed at battle start (also carried in snapshot once countdown+). */
  problem: PublicProblem | null;
  /** authoritative epoch-ms the battle ends; null before it starts. */
  endAtMs: number | null;
  /** (client clock - server clock) estimate, for a smooth cosmetic timer. */
  serverClockSkewMs: number;
  /** aggregate opponent-safe progress per side. */
  progress: SideProgress[];
  /** my own full submission results, newest last. */
  ownSubmissions: SubmissionResultView[];
  /** set while a countdown is running; ms remaining at last event. */
  countdownMs: number | null;
  /** transient out-of-band error banners. */
  lastError: string | null;
  /** XP/streak awarded when the battle finished; empty until then. */
  awards: ProgressionAward[];
}

export const initialBattleState: BattleState = {
  snapshot: null,
  myUserId: null,
  problem: null,
  endAtMs: null,
  serverClockSkewMs: 0,
  progress: [],
  ownSubmissions: [],
  countdownMs: null,
  lastError: null,
  awards: [],
};

/** Merge a fresh snapshot into local state. */
function applySnapshot(state: BattleState, snap: BattleSnapshot): BattleState {
  return {
    ...state,
    snapshot: snap,
    problem: snap.problem ?? state.problem,
    endAtMs: snap.serverEndAt ?? state.endAtMs,
    serverClockSkewMs: Date.now() - snap.serverNowMs,
    progress: snap.progress,
    ownSubmissions: snap.ownSubmissions,
    countdownMs: snap.status === "COUNTDOWN" ? state.countdownMs : null,
  };
}

/**
 * Fold one server message into state. Acks are handled out-of-band by the
 * connection (reqId correlation), but ack-carried snapshots still flow here.
 */
export function reduceBattle(
  state: BattleState,
  msg: BattleAction,
): BattleState {
  switch (msg.t) {
    case "@hello":
      return applySnapshot({ ...state, myUserId: msg.userId }, msg.snapshot);

    case "snapshot":
      return applySnapshot(state, msg.snapshot);

    case "lobby:update": {
      if (!state.snapshot) return state;
      return {
        ...state,
        snapshot: {
          ...state.snapshot,
          players: msg.players,
          config: msg.config,
        },
      };
    }

    case "battle:countdown":
      return { ...state, countdownMs: msg.startsInMs };

    case "battle:start":
      return {
        ...state,
        problem: msg.problem,
        endAtMs: msg.serverEndAt,
        serverClockSkewMs: Date.now() - msg.serverNowMs,
        countdownMs: null,
        snapshot: state.snapshot
          ? {
              ...state.snapshot,
              status: "IN_PROGRESS",
              problem: msg.problem,
              serverStartAt: msg.serverStartAt,
              serverEndAt: msg.serverEndAt,
            }
          : state.snapshot,
      };

    case "timer:tick":
      return {
        ...state,
        endAtMs: msg.endAtMs,
        serverClockSkewMs: Date.now() - msg.serverNowMs,
      };

    case "opponent:progress":
      return { ...state, progress: msg.progress };

    case "submission:result": {
      const existing = state.ownSubmissions.filter(
        (s) => s.submissionId !== msg.result.submissionId,
      );
      const isMine = msg.result.userId === state.myUserId;
      return {
        ...state,
        ownSubmissions: isMine
          ? [...existing, msg.result]
          : state.ownSubmissions,
      };
    }

    case "presence:update": {
      if (!state.snapshot) return state;
      return {
        ...state,
        snapshot: {
          ...state.snapshot,
          players: state.snapshot.players.map((p) =>
            p.userId === msg.userId ? { ...p, presence: msg.status } : p,
          ),
        },
      };
    }

    case "battle:finished":
      return {
        ...state,
        snapshot: state.snapshot
          ? {
              ...state.snapshot,
              status: "FINISHED",
              winnerSide: msg.winnerSide,
              finishReason: msg.reason,
            }
          : state.snapshot,
        awards: msg.awards ?? [],
      };

    case "error":
      return { ...state, lastError: msg.message };

    // Acks / pong are handled by the connection layer, not the reducer.
    case "ack":
    case "ack-error":
    case "pong":
    case "submission:queued":
      return state;

    default:
      return state;
  }
}

/** Convenience: my own player row from the current snapshot. */
export function selectMe(state: BattleState) {
  return (
    state.snapshot?.players.find((p) => p.userId === state.myUserId) ?? null
  );
}

/** Best passed-count for a given side (0 if unknown). */
export function selectSideProgress(
  state: BattleState,
  side: Side,
): { bestPassed: number; total: number } {
  const row = state.progress.find((p) => p.side === side);
  return { bestPassed: row?.bestPassed ?? 0, total: row?.total ?? 0 };
}
