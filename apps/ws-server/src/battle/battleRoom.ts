import type { WebSocket } from "ws";
import { prisma } from "@repo/db";
import {
  MODE_TEAM_SIZE,
  normalizeAvatar,
  type BattleConfig,
  type BattleStatus,
  type FinishReason,
  type Language,
  type ProgressionAward,
  type PublicProblem,
  type ServerMessage,
  type StandingRow,
  type Side,
  type SubmissionStatus,
} from "@repo/protocol";
import {
  buildStandings,
  canStart,
  checkInstantWin,
  isSlotAvailable,
  resolveOnTimeout,
  seededPick,
  startBlockedReason,
  type JudgedSubmission,
  type LobbyPlayer,
} from "@repo/game";
import { env } from "../config/env.js";
import type { JudgePipeline } from "../infra/judgeQueue.js";
import type { Connection, LobbySeat, RoomSubmission } from "../types.js";
import { buildSnapshot, toPublicProblem, toSideProgress } from "./projections.js";
import { applyProgression } from "./progression.js";
import { Broadcaster } from "./broadcaster.js";

/**
 * How long a problem stays off-limits to a player who has already fought it.
 *
 * Two days. Long enough that a session — or a run of sessions over a weekend —
 * never repeats, short enough that a modest problem bank keeps recycling
 * instead of being permanently used up.
 */
const REPEAT_COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Authoritative, in-memory state and lifecycle for ONE battle. Everything the
 * game needs to make decisions lives here; Postgres is written through as the
 * durable record. Wall-clock time is the server's — client timers are cosmetic.
 */
export class BattleRoom {
  readonly battleId: string;
  readonly roomCode: string;
  readonly hostUserId: string;
  readonly config: BattleConfig;
  private readonly seed: string;

  private status: BattleStatus;
  /** userId -> seat (roster). A user has a seat even before picking a side. */
  private readonly seats = new Map<string, LobbySeat>();
  /** Owns live sockets + all outbound framing (reconnect tolerant). */
  private readonly wire = new Broadcaster();
  /** submissionId -> tracked submission (for progress + win resolution). */
  private readonly submissions = new Map<string, RoomSubmission>();

  private problem: PublicProblem | null = null;
  private serverStartAt: number | null = null;
  private serverEndAt: number | null = null;
  private winnerSide: Side | null = null;
  private finishReason: FinishReason | null = null;

  private countdownTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private endTimer: NodeJS.Timeout | null = null;

  constructor(args: {
    battleId: string;
    roomCode: string;
    hostUserId: string;
    config: BattleConfig;
    seed: string;
    status: BattleStatus;
    onEmpty: (battleId: string) => void;
    judge: JudgePipeline;
  }) {
    this.battleId = args.battleId;
    this.roomCode = args.roomCode;
    this.hostUserId = args.hostUserId;
    this.config = args.config;
    this.seed = args.seed;
    this.status = args.status;
    this.onEmpty = args.onEmpty;
    this.judge = args.judge;
  }

  private readonly onEmpty: (battleId: string) => void;
  private readonly judge: JudgePipeline;

  // --- clock ----------------------------------------------------------------
  private now(): number {
    return Date.now();
  }

  // --- roster / connections -------------------------------------------------

  /**
   * User ids currently holding an ONLINE seat in this room.
   *
   * Read by the admin dashboard through the registry. Returns ids, not a
   * count, so the registry can de-duplicate someone sitting in two rooms.
   */
  onlineUserIds(): string[] {
    return [...this.seats.values()]
      .filter((s) => s.presence === "ONLINE")
      .map((s) => s.userId);
  }

  /** Attach a socket for a user, creating a seat on first join. */
  attach(conn: Connection): void {
    let seat = this.seats.get(conn.userId);
    if (!seat) {
      seat = {
        userId: conn.userId,
        username: conn.username,
        name: conn.name,
        avatarId: conn.avatarId,
        avatarColor: conn.avatarColor,
        imageUrl: conn.imageUrl,
        side: null,
        slot: null,
        ready: false,
        presence: "ONLINE",
      };
      this.seats.set(conn.userId, seat);
    } else {
      seat.presence = "ONLINE";
      seat.username = conn.username;
      seat.name = conn.name;
      seat.avatarId = conn.avatarId;
      seat.avatarColor = conn.avatarColor;
      seat.imageUrl = conn.imageUrl;
    }

    this.wire.add(conn.userId, conn.ws);

    this.broadcastLobby();
    this.broadcastPresence(conn.userId, "ONLINE");
  }

  /** Detach one socket. Marks the user disconnected when their last one closes. */
  detach(userId: string, ws: WebSocket): void {
    const wentOffline = this.wire.remove(userId, ws);
    if (wentOffline) {
      const seat = this.seats.get(userId);
      if (seat) {
        seat.presence = "DISCONNECTED";
        this.broadcastPresence(userId, "DISCONNECTED");
      }
      // In the lobby a fully-gone player frees their seat; mid-battle we keep
      // the seat so their submissions still count on timeout resolution.
      if (this.status === "LOBBY" || this.status === "COUNTDOWN") {
        this.seats.delete(userId);
        this.maybeCancelCountdown();
      }
    }
    this.broadcastLobby();

    // If nobody is connected at all, ask the registry to evict us.
    if (!this.wire.hasConnections()) this.onEmpty(this.battleId);
  }

  hasConnections(): boolean {
    return this.wire.hasConnections();
  }

  // --- lobby actions --------------------------------------------------------

  /** Pick a seat (side + slot). Returns an error message, or null on success. */
  selectSeat(userId: string, side: Side, slot: number): string | null {
    if (this.status !== "LOBBY" && this.status !== "COUNTDOWN") {
      return "Battle already started.";
    }
    const seat = this.seats.get(userId);
    if (!seat) return "You are not in this room.";

    if (!isSlotAvailable(this.lobbyPlayers(), this.config.mode, side, slot, userId)) {
      return "That seat is taken.";
    }
    seat.side = side;
    seat.slot = slot;
    seat.ready = false; // changing seats clears readiness
    // Selecting a seat while a countdown is running cancels it (roster changed).
    this.maybeCancelCountdown();
    this.broadcastLobby();
    return null;
  }

  setReady(userId: string, ready: boolean): string | null {
    if (this.status !== "LOBBY" && this.status !== "COUNTDOWN") {
      return "Battle already started.";
    }
    const seat = this.seats.get(userId);
    if (!seat) return "You are not in this room.";
    if (seat.side === null || seat.slot === null) {
      return "Pick a seat before readying up.";
    }
    seat.ready = ready;
    if (!ready) this.maybeCancelCountdown();
    this.broadcastLobby();
    return null;
  }

  /** Host-only: begin the countdown if the lobby is startable. */
  async start(userId: string): Promise<string | null> {
    if (userId !== this.hostUserId) return "Only the host can start.";
    if (this.status !== "LOBBY") return "Battle is not in the lobby.";
    const blocked = startBlockedReason(this.lobbyPlayers());
    if (blocked) return blocked;
    if (!canStart(this.lobbyPlayers())) return "Lobby is not ready.";

    this.status = "COUNTDOWN";
    await prisma.battle.update({
      where: { id: this.battleId },
      data: { status: "COUNTDOWN" },
    });

    this.broadcast({ t: "battle:countdown", startsInMs: env.countdownMs });
    this.countdownTimer = setTimeout(() => {
      void this.beginBattle();
    }, env.countdownMs);
    return null;
  }

  /** Cancel an in-flight countdown and fall back to LOBBY. */
  private maybeCancelCountdown(): void {
    if (this.status !== "COUNTDOWN") return;
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.status = "LOBBY";
    void prisma.battle
      .update({ where: { id: this.battleId }, data: { status: "LOBBY" } })
      .catch(() => {});
  }

  // --- battle lifecycle -----------------------------------------------------

  /** Reveal the problem, stamp the clock, and go IN_PROGRESS. */
  private async beginBattle(): Promise<void> {
    this.countdownTimer = null;
    if (this.status !== "COUNTDOWN") return; // cancelled meanwhile

    /*
     * Pick a problem of the room's difficulty that the seated players have not
     * already fought.
     *
     * A repeat is not merely dull: a player who has seen the problem can paste
     * their previous solution and win on the first submission, which hands the
     * battle to whoever happened to draw a familiar question rather than to
     * whoever codes better.
     *
     * The seen-set is per BATTLE, not per player: a problem either side has
     * met is excluded, because an advantage to one player is exactly the
     * unfairness this avoids.
     *
     * The window is REPEAT_COOLDOWN_MS rather than forever. A permanent
     * exclusion sounds stricter but is worse: every player eventually exhausts
     * the bank and then sees repeats anyway, only now the fallback fires
     * constantly and the exclusion has stopped meaning anything. A rolling
     * window keeps the guarantee honest — nothing you fought in the last two
     * days — and lets the pool recycle.
     *
     * Falls back to the full pool when everything in the window has been seen,
     * because a repeat beats refusing to start the battle.
     */
    const seatedIds = [...this.seats.values()].map((s) => s.userId);
    /*
     * APPROVED only. This is the single gate between a community submission
     * and live play: a problem someone submitted five minutes ago is PENDING
     * until an admin reads it, and must never be handed to a ranked battle
     * unreviewed. Widening this `where` is how unvetted content — or a
     * deliberately broken test suite — would reach players.
     */
    const all = await prisma.problem.findMany({
      where: { difficulty: this.config.difficulty, status: "APPROVED" },
      select: { id: true },
    });

    const since = new Date(Date.now() - REPEAT_COOLDOWN_MS);
    const seen = seatedIds.length
      ? new Set(
          (
            await prisma.battle.findMany({
              where: {
                id: { not: this.battleId },
                assignedProblemId: { not: null },
                createdAt: { gte: since },
                teams: {
                  some: { members: { some: { userId: { in: seatedIds } } } },
                },
              },
              select: { assignedProblemId: true },
            })
          ).map((b) => b.assignedProblemId as string),
        )
      : new Set<string>();

    const fresh = all.filter((p) => !seen.has(p.id));
    const candidates = fresh.length > 0 ? fresh : all;
    const picked = seededPick(candidates, this.seed);
    if (!picked) {
      this.status = "LOBBY";
      this.broadcastError(
        "NO_PROBLEM",
        `No ${this.config.difficulty} problems are available.`,
      );
      await prisma.battle
        .update({ where: { id: this.battleId }, data: { status: "LOBBY" } })
        .catch(() => {});
      return;
    }

    const problemRow = await prisma.problem.findUniqueOrThrow({
      where: { id: picked.id },
      include: { testCases: true },
    });
    this.problem = toPublicProblem(problemRow, problemRow.testCases);

    const start = this.now();
    const end = start + this.config.timeLimitSec * 1000;
    this.serverStartAt = start;
    this.serverEndAt = end;
    this.status = "IN_PROGRESS";

    await prisma.battle.update({
      where: { id: this.battleId },
      data: {
        status: "IN_PROGRESS",
        assignedProblemId: picked.id,
        serverStartAt: new Date(start),
        serverEndAt: new Date(end),
      },
    });

    // Persist the seat assignments now that they are locked. Until this point
    // seats live only in memory; without them a reconnecting player would
    // rejoin unseated and be told "you are not competing". See resumeInProgress.
    await this.persistSeats();

    this.broadcast({
      t: "battle:start",
      problem: this.problem,
      serverStartAt: start,
      serverEndAt: end,
      serverNowMs: start,
    });

    // Authoritative timer corrections + the end-of-battle trigger.
    this.tickTimer = setInterval(() => this.tick(), env.timerTickMs);
    this.endTimer = setTimeout(
      () => void this.finishOnTimeout(),
      Math.max(0, end - start),
    );
  }

  /**
   * Re-hydrate a battle that was already IN_PROGRESS when this room was
   * reconstructed from the database (e.g. every socket dropped and someone
   * reconnected, or ws-server restarted).
   *
   * The live problem and clock only ever existed in the memory of the room
   * that ran `start()`. Without this, a resumed room reports IN_PROGRESS with
   * a null problem, and the arena is stuck on "Revealing the problem…" forever.
   * If the clock has already expired, finish immediately instead of resuming.
   */
  async resumeInProgress(persisted: {
    assignedProblemId: string | null;
    serverStartAt: Date | null;
    serverEndAt: Date | null;
  }): Promise<void> {
    if (this.status !== "IN_PROGRESS") return;
    if (this.problem !== null) return; // already hydrated
    if (!persisted.assignedProblemId || !persisted.serverEndAt) return;

    const problemRow = await prisma.problem.findUnique({
      where: { id: persisted.assignedProblemId },
      include: { testCases: true },
    });
    if (!problemRow) return;

    this.problem = toPublicProblem(problemRow, problemRow.testCases);
    this.serverStartAt = persisted.serverStartAt?.getTime() ?? this.now();
    this.serverEndAt = persisted.serverEndAt.getTime();

    // Restore the seat assignments persisted at start(), so a reconnecting
    // player is recognised as a competitor and may submit. They arrive
    // DISCONNECTED and flip to ONLINE when their socket attaches.
    await this.restoreSeats();

    const remaining = this.serverEndAt - this.now();
    if (remaining <= 0) {
      // The clock ran out while nobody was connected — settle it now, using
      // the same timeout resolution the live end-timer would have.
      await this.finishOnTimeout();
      return;
    }

    // Re-arm the authoritative timer + end trigger for the remaining window.
    this.clearTimers();
    this.tickTimer = setInterval(() => this.tick(), env.timerTickMs);
    this.endTimer = setTimeout(() => void this.finishOnTimeout(), remaining);
  }

  /**
   * Write the current seated players to Team / TeamMember. Called once at
   * start(), when seats are locked. Idempotent: recreates the rows so a
   * re-run reflects the final seating exactly.
   */
  private async persistSeats(): Promise<void> {
    const seated = [...this.seats.values()].filter(
      (s) => s.side !== null && s.slot !== null,
    );
    if (seated.length === 0) return;

    const sides = [...new Set(seated.map((s) => s.side))] as Side[];

    await prisma.$transaction(async (tx) => {
      // Clear any prior rows for this battle, then rewrite from memory.
      await tx.team.deleteMany({ where: { battleId: this.battleId } });
      for (const side of sides) {
        await tx.team.create({
          data: {
            battleId: this.battleId,
            side,
            members: {
              create: seated
                .filter((s) => s.side === side)
                .map((s) => ({ userId: s.userId, slot: s.slot as number })),
            },
          },
        });
      }
    });
  }

  /** Load persisted seats into memory (used only on cold hydration). */
  private async restoreSeats(): Promise<void> {
    if (this.seats.size > 0) return; // live seats win

    const teams = await prisma.team.findMany({
      where: { battleId: this.battleId },
      include: { members: { include: { user: true } } },
    });

    for (const team of teams) {
      for (const m of team.members) {
        const avatar = normalizeAvatar(
          m.user.avatarId,
          m.user.avatarColor,
          m.userId,
        );
        this.seats.set(m.userId, {
          userId: m.userId,
          username: m.user.username,
          name: m.user.name,
          avatarId: avatar.avatarId,
          avatarColor: avatar.avatarColor,
          imageUrl: m.user.imageUrl,
          side: team.side,
          slot: m.slot,
          ready: true, // the battle already started — they were ready
          presence: "DISCONNECTED",
        });
      }
    }
  }

  private tick(): void {
    if (this.status !== "IN_PROGRESS" || this.serverEndAt === null) return;
    this.broadcast({
      t: "timer:tick",
      serverNowMs: this.now(),
      endAtMs: this.serverEndAt,
    });
  }

  // --- submissions ----------------------------------------------------------

  /**
   * A player submitted code. Persist it, enqueue the judge job, and broadcast
   * that it's queued. Returns the submissionId, or an error message.
   */
  async submit(
    userId: string,
    language: Language,
    source: string,
  ): Promise<{ submissionId: string } | { error: string }> {
    if (this.status !== "IN_PROGRESS") return { error: "Battle is not live." };
    const seat = this.seats.get(userId);
    if (!seat || seat.side === null) return { error: "You are not competing." };
    if (this.problem === null) return { error: "No problem assigned." };
    if (!this.problem.allowedLanguages.includes(language)) {
      return { error: `${language} is not allowed for this problem.` };
    }

    // Throttle: cap in-flight submissions per user.
    const pending = [...this.submissions.values()].filter(
      (s) =>
        s.userId === userId &&
        (s.status === "QUEUED" || s.status === "RUNNING"),
    ).length;
    if (pending >= env.maxPendingSubmissionsPerUser) {
      return { error: "You have too many submissions in flight." };
    }

    const submittedAt = this.now();
    const row = await prisma.submission.create({
      data: {
        battleId: this.battleId,
        userId,
        teamSide: seat.side,
        language,
        sourceCode: source,
        status: "QUEUED",
        totalCount: this.problem.totalTests,
        submittedAt: new Date(submittedAt),
      },
    });

    const tracked: RoomSubmission = {
      submissionId: row.id,
      userId,
      side: seat.side,
      language,
      status: "QUEUED",
      passed: 0,
      total: this.problem.totalTests,
      timeMs: 0,
      errorMessage: null,
      submittedAt,
    };
    this.submissions.set(row.id, tracked);

    await this.judge.enqueue({
      submissionId: row.id,
      battleId: this.battleId,
      problemId: this.problem.id,
      userId,
      side: seat.side,
      language,
      source,
    });

    this.broadcast({
      t: "submission:queued",
      submissionId: row.id,
      userId,
      side: seat.side,
    });

    return { submissionId: row.id };
  }

  /**
   * A judge result arrived from the worker. Update state, broadcast the result
   * (opponent-safe) + progress, then check for an instant win.
   */
  async applyJudgeResult(result: {
    submissionId: string;
    passed: number;
    total: number;
    timeMs: number;
    allPassed: boolean;
    errorMessage: string | null;
  }): Promise<void> {
    const tracked = this.submissions.get(result.submissionId);
    if (!tracked) return; // not ours, or already resolved battle

    const status: SubmissionStatus =
      result.errorMessage !== null ? "ERROR" : "COMPLETED";
    tracked.status = status;
    tracked.passed = result.passed;
    tracked.total = result.total;
    tracked.timeMs = result.timeMs;
    tracked.errorMessage = result.errorMessage;

    await prisma.submission
      .update({
        where: { id: result.submissionId },
        data: {
          status,
          passedCount: result.passed,
          totalCount: result.total,
          runtimeMs: Math.round(result.timeMs),
          errorMessage: result.errorMessage,
          judgedAt: new Date(),
        },
      })
      .catch((err) => console.error("[room] submission update failed:", err));

    this.broadcast({
      t: "submission:result",
      result: {
        submissionId: tracked.submissionId,
        userId: tracked.userId,
        side: tracked.side,
        status: tracked.status,
        passed: tracked.passed,
        total: tracked.total,
        timeMs: tracked.timeMs,
        errorMessage: tracked.errorMessage,
      },
    });
    this.broadcast({
      t: "opponent:progress",
      progress: toSideProgress([...this.submissions.values()]),
    });

    // Instant-win check across all judged submissions.
    const outcome = checkInstantWin(this.judgedSubmissions());
    if (outcome) {
      await this.finish(outcome.winnerSide, outcome.reason, outcome.decidingSubmissionId);
    }
  }

  private async finishOnTimeout(): Promise<void> {
    if (this.status !== "IN_PROGRESS") return;
    const outcome = resolveOnTimeout(this.judgedSubmissions());
    await this.finish(outcome.winnerSide, outcome.reason, outcome.decidingSubmissionId);
  }

  /** Terminal transition: persist the result and broadcast the finish. */
  private async finish(
    winnerSide: Side | null,
    reason: FinishReason,
    decidingSubmissionId: string | null,
  ): Promise<void> {
    if (this.status === "FINISHED") return;
    this.status = "FINISHED";
    this.winnerSide = winnerSide;
    this.finishReason = reason;
    this.clearTimers();

    const standings = buildStandings(this.judgedSubmissions());

    await prisma.$transaction([
      prisma.battle.update({
        where: { id: this.battleId },
        data: { status: "FINISHED", winnerSide, finishReason: reason },
      }),
      prisma.result.upsert({
        where: { battleId: this.battleId },
        create: {
          battleId: this.battleId,
          winnerSide,
          reason,
          decidingSubmissionId,
          standings,
        },
        update: { winnerSide, reason, decidingSubmissionId, standings },
      }),
    ]).catch((err) => console.error("[room] finish persistence failed:", err));

    // Progression is best-effort: a failure here must not stop the finish
    // broadcast, or players would be left staring at a live battle that ended.
    const awards = await this.awardProgression(winnerSide, reason, standings).catch(
      (err) => {
        console.error("[room] progression failed:", err);
        return [] as ProgressionAward[];
      },
    );

    this.broadcast({
      t: "battle:finished",
      winnerSide,
      reason,
      standings,
      decidingSubmissionId,
      awards,
    });
  }

  /**
   * Grant everything the finished battle was worth, and return the per-player
   * breakdown for the results screen.
   *
   * The rules live in ./progression.ts, which is the only place that knows XP,
   * rating and badges all move on different triggers.
   */
  private async awardProgression(
    winnerSide: Side | null,
    reason: FinishReason,
    standings: StandingRow[],
  ): Promise<ProgressionAward[]> {
    return applyProgression({
      battleId: this.battleId,
      isRanked: this.config.isRanked,
      difficulty: this.config.difficulty,
      reason,
      winnerSide,
      standings,
      seats: [...this.seats.values()].map((s) => ({
        userId: s.userId,
        side: s.side,
      })),
      problemId: this.problem?.id ?? null,
    });
  }

  // --- helpers --------------------------------------------------------------

  private lobbyPlayers(): LobbyPlayer[] {
    return [...this.seats.values()].map((s) => ({
      userId: s.userId,
      side: s.side,
      slot: s.slot,
      ready: s.ready,
    }));
  }

  private judgedSubmissions(): JudgedSubmission[] {
    return [...this.submissions.values()]
      .filter((s) => s.status === "COMPLETED" || s.status === "ERROR")
      .map((s) => ({
        submissionId: s.submissionId,
        side: s.side,
        passed: s.passed,
        total: s.total,
        submittedAt: s.submittedAt,
      }));
  }

  /** Seats per side for this room's mode. */
  seatCapacity(): number {
    return MODE_TEAM_SIZE[this.config.mode];
  }

  // --- broadcasting (delegated to the Broadcaster) --------------------------

  private broadcast(msg: ServerMessage): void {
    this.wire.broadcast(msg);
  }

  private broadcastError(code: string, message: string): void {
    this.wire.broadcastError(code, message);
  }

  private broadcastLobby(): void {
    const players = [...this.seats.values()].map((s) => ({
      userId: s.userId,
      username: s.username,
      name: s.name,
      avatarId: s.avatarId,
      avatarColor: s.avatarColor,
      imageUrl: s.imageUrl,
      side: s.side,
      slot: s.slot,
      ready: s.ready,
      presence: s.presence,
      isHost: s.userId === this.hostUserId,
    }));
    this.broadcast({ t: "lobby:update", players, config: this.config });
  }

  private broadcastPresence(
    userId: string,
    status: LobbySeat["presence"],
  ): void {
    this.broadcast({ t: "presence:update", userId, status });
  }

  /** Build the full snapshot for one caller (their own submissions included). */
  snapshotFor(userId: string) {
    return buildSnapshot({
      battleId: this.battleId,
      roomCode: this.roomCode,
      status: this.status,
      config: this.config,
      seats: [...this.seats.values()],
      hostUserId: this.hostUserId,
      problem: this.problem,
      serverStartAt: this.serverStartAt,
      serverEndAt: this.serverEndAt,
      serverNowMs: this.now(),
      submissions: [...this.submissions.values()],
      forUserId: userId,
      winnerSide: this.winnerSide,
      finishReason: this.finishReason,
    });
  }

  private clearTimers(): void {
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.endTimer) clearTimeout(this.endTimer);
    this.countdownTimer = null;
    this.tickTimer = null;
    this.endTimer = null;
  }

  /** Tear down (server shutdown / eviction). */
  dispose(): void {
    this.clearTimers();
  }
}
