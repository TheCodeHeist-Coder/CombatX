import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "@repo/db";
import { signGuestToken, verifyGuestToken, type GuestClaims } from "@repo/auth";
import {
  CreateBattleRequest,
  GuestAuthRequest,
  JoinBattleRequest,
  type BattleResultResponse,
  type CreateBattleResponse,
  type GuestAuthResponse,
  type JoinBattleResponse,
  type StandingRow,
} from "@repo/protocol";
import { env } from "./env.js";
import { generateRoomCode } from "./roomCode.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.corsOrigins,
  credentials: true,
});

/** Extract and verify the bearer token; returns claims or replies 401. */
async function authenticate(
  authHeader: string | undefined,
): Promise<GuestClaims | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  try {
    return await verifyGuestToken(token, env.jwtSecret);
  } catch {
    return null;
  }
}

app.get("/health", async () => ({ ok: true }));

// --- Guest auth: create an identity, return a signed token ------------------
app.post("/auth/guest", async (req, reply) => {
  const parsed = GuestAuthRequest.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ code: "BAD_REQUEST", message: "Invalid display name" });
  }
  const user = await prisma.user.create({
    data: { displayName: parsed.data.displayName },
  });
  const token = await signGuestToken(
    { userId: user.id, displayName: user.displayName },
    env.jwtSecret,
  );
  const res: GuestAuthResponse = {
    token,
    userId: user.id,
    displayName: user.displayName,
  };
  return reply.send(res);
});

// --- Create a battleground --------------------------------------------------
app.post("/battles", async (req, reply) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return reply.code(401).send({ code: "UNAUTHORIZED", message: "Login required" });

  const parsed = CreateBattleRequest.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ code: "BAD_REQUEST", message: "Invalid battle config" });
  }
  const { mode, difficulty, timeLimitSec } = parsed.data;

  // Retry room-code generation a few times in the rare event of a collision.
  let roomCode = generateRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.battle.findUnique({ where: { roomCode } });
    if (!existing) break;
    roomCode = generateRoomCode();
  }

  const battle = await prisma.battle.create({
    data: {
      roomCode,
      mode,
      difficulty,
      timeLimitSec,
      seed: `${roomCode}-${Date.now()}`,
      hostUserId: claims.userId,
      status: "LOBBY",
      teams: {
        create: [{ side: "A" }, { side: "B" }],
      },
    },
  });

  const res: CreateBattleResponse = { battleId: battle.id, roomCode: battle.roomCode };
  return reply.send(res);
});

// --- Join a battleground by room code ---------------------------------------
app.post("/battles/join", async (req, reply) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return reply.code(401).send({ code: "UNAUTHORIZED", message: "Login required" });

  const parsed = JoinBattleRequest.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ code: "BAD_REQUEST", message: "Invalid room code" });
  }
  const roomCode = parsed.data.roomCode.toUpperCase();

  const battle = await prisma.battle.findUnique({ where: { roomCode } });
  if (!battle) {
    return reply.code(404).send({ code: "NOT_FOUND", message: "No battle with that code" });
  }
  if (battle.status !== "LOBBY" && battle.status !== "COUNTDOWN") {
    return reply.code(409).send({ code: "IN_PROGRESS", message: "Battle already started" });
  }

  // Seat selection itself happens over the WS connection; here we only confirm
  // the room is joinable and hand back its id so the client can open the socket.
  const res: JoinBattleResponse = { battleId: battle.id, roomCode: battle.roomCode };
  return reply.send(res);
});

// --- Read final result for the results screen -------------------------------
app.get<{ Params: { id: string } }>("/battles/:id/result", async (req, reply) => {
  const battle = await prisma.battle.findUnique({
    where: { id: req.params.id },
    include: { result: true },
  });
  if (!battle) {
    return reply.code(404).send({ code: "NOT_FOUND", message: "Battle not found" });
  }

  const standings = (battle.result?.standings as StandingRow[] | undefined) ?? [];
  const res: BattleResultResponse = {
    battleId: battle.id,
    config: {
      mode: battle.mode,
      difficulty: battle.difficulty,
      timeLimitSec: battle.timeLimitSec,
    },
    winnerSide: battle.winnerSide ?? null,
    reason: battle.finishReason ?? null,
    standings,
    decidingSubmissionId: battle.result?.decidingSubmissionId ?? null,
  };
  return reply.send(res);
});

app
  .listen({ port: env.port, host: env.host })
  .then((addr) => app.log.info(`http-api listening on ${addr}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
