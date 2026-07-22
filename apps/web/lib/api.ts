import {
  BattleResultResponse,
  CreateBattleResponse,
  GuestAuthResponse,
  ProfileResponse,
  JoinBattleResponse,
  type CreateBattleRequest,
  type Difficulty,
  type Mode,
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
  init: RequestInit,
  parse: (data: unknown) => T,
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

/** POST /auth/guest — mint a guest identity + JWT. */
export function createGuest(displayName: string): Promise<GuestAuthResponse> {
  return request(
    "/auth/guest",
    { method: "POST", body: JSON.stringify({ displayName }) },
    (d) => GuestAuthResponse.parse(d),
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

/** GET /battles/:id/result — the final, shareable result. */
export function getBattleResult(
  battleId: string,
): Promise<BattleResultResponse> {
  return request(`/battles/${battleId}/result`, { method: "GET" }, (d) =>
    BattleResultResponse.parse(d),
  );
}
