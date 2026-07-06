import "./loadEnv.js"; // must be first — loads .env before @repo/db reads it
import express, { type Request, type Response } from "express";
import cors from "cors";
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

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: env.corsOrigins, credentials: true }));

/** Wrap an async handler so rejected promises reach Express' error handler. */
function asyncHandler<Req extends Request>(
  fn: (req: Req, res: Response) => Promise<unknown>,
): (req: Req, res: Response) => void {
  return (req, res) => {
    fn(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) {
        res.status(500).send({ code: "INTERNAL", message: "Server error" });
      }
    });
  };
}

/** Extract and verify the bearer token; returns claims or null. */
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

app.get("/health", (_req, res) => {
  res.send({ ok: true });
});

// --- Guest auth: create an identity, return a signed token ------------------
app.post(
  "/auth/guest",
  asyncHandler(async (req, res) => {
    const parsed = GuestAuthRequest.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .send({ code: "BAD_REQUEST", message: "Invalid display name" });
    }
    const user = await prisma.user.create({
      data: { displayName: parsed.data.displayName },
    });
    const token = await signGuestToken(
      { userId: user.id, displayName: user.displayName },
      env.jwtSecret,
    );
    const body: GuestAuthResponse = {
      token,
      userId: user.id,
      displayName: user.displayName,
    };
    return res.send(body);
  }),
);

// --- Create a battleground --------------------------------------------------
app.post(
  "/battles",
  asyncHandler(async (req, res) => {
    const claims = await authenticate(req.headers.authorization);
    if (!claims) {
      return res
        .status(401)
        .send({ code: "UNAUTHORIZED", message: "Login required" });
    }

    const parsed = CreateBattleRequest.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .send({ code: "BAD_REQUEST", message: "Invalid battle config" });
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

    const body: CreateBattleResponse = {
      battleId: battle.id,
      roomCode: battle.roomCode,
    };
    return res.send(body);
  }),
);

// --- Join a battleground by room code ---------------------------------------
app.post(
  "/battles/join",
  asyncHandler(async (req, res) => {
    const claims = await authenticate(req.headers.authorization);
    if (!claims) {
      return res
        .status(401)
        .send({ code: "UNAUTHORIZED", message: "Login required" });
    }

    const parsed = JoinBattleRequest.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .send({ code: "BAD_REQUEST", message: "Invalid room code" });
    }
    const roomCode = parsed.data.roomCode.toUpperCase();

    const battle = await prisma.battle.findUnique({ where: { roomCode } });
    if (!battle) {
      return res
        .status(404)
        .send({ code: "NOT_FOUND", message: "No battle with that code" });
    }
    if (battle.status !== "LOBBY" && battle.status !== "COUNTDOWN") {
      return res
        .status(409)
        .send({ code: "IN_PROGRESS", message: "Battle already started" });
    }

    // Seat selection itself happens over the WS connection; here we only confirm
    // the room is joinable and hand back its id so the client can open the socket.
    const body: JoinBattleResponse = {
      battleId: battle.id,
      roomCode: battle.roomCode,
    };
    return res.send(body);
  }),
);

// --- Read final result for the results screen -------------------------------
app.get(
  "/battles/:id/result",
  asyncHandler(async (req: Request<{ id: string }>, res) => {
    const battle = await prisma.battle.findUnique({
      where: { id: req.params.id },
      include: { result: true },
    });
    if (!battle) {
      return res
        .status(404)
        .send({ code: "NOT_FOUND", message: "Battle not found" });
    }

    const standings = (battle.result?.standings as StandingRow[] | undefined) ?? [];
    const body: BattleResultResponse = {
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
    return res.send(body);
  }),
);

app.listen(env.port, env.host, () => {
  console.log(`http-api listening on http://${env.host}:${env.port}`);
});
