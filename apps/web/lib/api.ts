import {
  BattleResultResponse,
  BattleSolutionsResponse,
  CreateBattleResponse,
  AuthResponse,
  UsernameAvailableResponse,
  ProfileResponse,
  LeaderboardResponse,
  BattleHistoryResponse,
  UpdateProfileResponse,
  JoinBattleResponse,
  type AvatarChoice,
  type CreateBattleRequest,
  type Difficulty,
  type Mode,
  type UpdateProfileRequest,
} from "@repo/protocol";
import { API_URL } from "./config";

/** A failed REST call, carrying the server's error code where available. */
export class ApiCallError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiCallError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  parse: (data: unknown) => T = (d) => d as T,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiCallError(
      "Can't reach the server. Is the API running?",
      "NETWORK",
      0,
    );
  }

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const err = body as { code?: string; message?: string } | null;
    throw new ApiCallError(
      err?.message ?? `Request failed (${res.status})`,
      err?.code ?? "UNKNOWN",
      res.status,
    );
  }

  return parse(body);
}

function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

/** POST /auth/signup — create an account and get a session token. */
export function signup(input: {
  email: string;
  password: string;
  username: string;
  name?: string;
  avatarId?: AvatarChoice["avatarId"];
  avatarColor?: AvatarChoice["avatarColor"];
}): Promise<AuthResponse> {
  return request(
    "/auth/signup",
    { method: "POST", body: JSON.stringify(input) },
    (d) => AuthResponse.parse(d),
  );
}

/** POST /auth/login — exchange email + password for a session token. */
export function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return request(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    (d) => AuthResponse.parse(d),
  );
}

/**
 * GET /auth/available — is this username free?
 *
 * Used to give the signup form a live tick before submitting. Advisory only:
 * the unique index is what actually prevents a duplicate, since someone else
 * can claim the name between this check and the insert.
 */
export function checkUsername(
  username: string,
  signal?: AbortSignal,
): Promise<UsernameAvailableResponse> {
  return request(
    `/auth/available?username=${encodeURIComponent(username)}`,
    { signal },
    (d) => UsernameAvailableResponse.parse(d),
  );
}

/** POST /battles — create a battleground you host. */
export function createBattle(
  token: string,
  config: { mode: Mode; difficulty: Difficulty; timeLimitSec: number },
): Promise<CreateBattleResponse> {
  const body: CreateBattleRequest = config;
  return request(
    "/battles",
    { method: "POST", headers: auth(token), body: JSON.stringify(body) },
    (d) => CreateBattleResponse.parse(d),
  );
}

/** POST /battles/join — join an existing battle by its room code. */
export function joinBattle(
  token: string,
  roomCode: string,
): Promise<JoinBattleResponse> {
  return request(
    "/battles/join",
    {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ roomCode }),
    },
    (d) => JoinBattleResponse.parse(d),
  );
}

/** GET /me — the caller's profile and progression. */
export function fetchProfile(token: string): Promise<ProfileResponse> {
  return request("/me", { method: "GET", headers: auth(token) }, (d) =>
    ProfileResponse.parse(d),
  );
}

/**
 * PATCH /me — update name and/or avatar. Every field is optional, so the
 * settings screen can save just the character without touching the callsign.
 * Returns a FRESH token (JWTs embed the display name).
 */
export function updateProfile(
  token: string,
  patch: UpdateProfileRequest,
): Promise<UpdateProfileResponse> {
  return request(
    "/me",
    {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify(patch),
    },
    (d) => UpdateProfileResponse.parse(d),
  );
}

/** GET /leaderboard — top operatives. Auth optional (locates your own row). */
export function fetchLeaderboard(token?: string): Promise<LeaderboardResponse> {
  return request(
    "/leaderboard",
    { method: "GET", headers: token ? auth(token) : undefined },
    (d) => LeaderboardResponse.parse(d),
  );
}

/** GET /me/battles — the caller's battle history. */
export function fetchMyBattles(token: string): Promise<BattleHistoryResponse> {
  return request("/me/battles", { method: "GET", headers: auth(token) }, (d) =>
    BattleHistoryResponse.parse(d),
  );
}

/**
 * GET /battles/:id/solutions — every player's source code.
 *
 * Rejects with a 409 NOT_FINISHED while the battle is still running; the code
 * is only readable once it is over.
 */
export function getBattleSolutions(
  battleId: string,
): Promise<BattleSolutionsResponse> {
  return request(`/battles/${battleId}/solutions`, { method: "GET" }, (d) =>
    BattleSolutionsResponse.parse(d),
  );
}

/** GET /battles/:id/result — the final, shareable result. */
export function getBattleResult(
  battleId: string,
): Promise<BattleResultResponse> {
  return request(`/battles/${battleId}/result`, { method: "GET" }, (d) =>
    BattleResultResponse.parse(d),
  );
}
