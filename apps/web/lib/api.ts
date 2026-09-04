import {
  BattleResultResponse,
  BattleSolutionsResponse,
  CreateBattleResponse,
  AuthResponse,
  GuestJoinResponse,
  UsernameAvailableResponse,
  ProfileResponse,
  PublicProfileResponse,
  LeaderboardResponse,
  BadgeShelfResponse,
  RatingHistoryResponse,
  QueueStatusResponse,
  BattleHistoryResponse,
  UpdateProfileResponse,
  JoinBattleResponse,
  IntelCatalogueResponse,
  MyProblemsResponse,
  MyProblemDetail,
  DuplicateCheckResponse,
  SubmitProblemResponse,
  LeagueListResponse,
  LeagueDetailResponse,
  LeagueCard,
  LeagueTeamView,
  LeagueFixtureView,
  LeagueProblemOptionsResponse,
  StartLegResponse,
  type CreateFixtureInput,
  type CreateLeagueInput,
  type CreateTeamInput,
  type UpdateLeagueInput,
  type CommunityProblemInput,
  type DuplicateCheckRequest,
  type AvatarChoice,
  type CreateBattleRequest,
  type Difficulty,
  type LeaderboardBoard,
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
 * POST /auth/guest — join a battle by room code with no account.
 *
 * Returns both a session and the battle to walk into, so the caller never has
 * to make a second call that could fail after the identity already exists.
 */
export function guestJoin(input: {
  roomCode: string;
  displayName: string;
  avatarId?: AvatarChoice["avatarId"];
  avatarColor?: AvatarChoice["avatarColor"];
}): Promise<GuestJoinResponse> {
  return request(
    "/auth/guest",
    { method: "POST", body: JSON.stringify(input) },
    (d) => GuestJoinResponse.parse(d),
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

/**
 * GET /users/:username — someone else's profile.
 *
 * The token is optional and only lets you fetch your OWN profile while it is
 * private; a private profile belonging to anyone else answers 404 either way.
 */
export function fetchPublicProfile(
  username: string,
  token?: string,
): Promise<PublicProfileResponse> {
  return request(
    `/users/${encodeURIComponent(username)}`,
    { headers: token ? auth(token) : {} },
    (d) => PublicProfileResponse.parse(d),
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

/**
 * GET /leaderboard — the ladder. Auth optional (locates your own row).
 *
 * `board` picks which question is being asked: "rating" is skill and the
 * default, "xp" is career volume.
 */
export function fetchLeaderboard(
  token?: string,
  board: LeaderboardBoard = "rating",
): Promise<LeaderboardResponse> {
  return request(
    `/leaderboard?board=${board}`,
    { method: "GET", headers: token ? auth(token) : undefined },
    (d) => LeaderboardResponse.parse(d),
  );
}

/** GET /users/:username/badges — the full shelf, earned and locked. */
export function fetchBadgeShelf(
  username: string,
  token?: string,
): Promise<BadgeShelfResponse> {
  return request(
    `/users/${encodeURIComponent(username)}/badges`,
    { headers: token ? auth(token) : {} },
    (d) => BadgeShelfResponse.parse(d),
  );
}

/** GET /users/:username/rating-history — points for the rating graph. */
export function fetchRatingHistory(
  username: string,
  token?: string,
): Promise<RatingHistoryResponse> {
  return request(
    `/users/${encodeURIComponent(username)}/rating-history`,
    { headers: token ? auth(token) : {} },
    (d) => RatingHistoryResponse.parse(d),
  );
}

// --- Ranked matchmaking ----------------------------------------------------

/** POST /matchmaking/queue — enter the ranked queue. */
export function joinRankedQueue(
  token: string,
  difficulty: Difficulty,
): Promise<QueueStatusResponse> {
  return request(
    "/matchmaking/queue",
    {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ difficulty }),
    },
    (d) => QueueStatusResponse.parse(d),
  );
}

/** GET /matchmaking/queue — poll for a match. */
export function fetchQueueStatus(
  token: string,
): Promise<QueueStatusResponse> {
  return request(
    "/matchmaking/queue",
    { method: "GET", headers: auth(token) },
    (d) => QueueStatusResponse.parse(d),
  );
}

/** DELETE /matchmaking/queue — leave the queue. */
export function leaveRankedQueue(
  token: string,
): Promise<QueueStatusResponse> {
  return request(
    "/matchmaking/queue",
    { method: "DELETE", headers: auth(token) },
    (d) => QueueStatusResponse.parse(d),
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

// --- Community problems -----------------------------------------------------

/** GET /problems/catalogue — the Intel list. Public; no statements or tests. */
export function fetchCatalogue(): Promise<IntelCatalogueResponse> {
  return request("/problems/catalogue", { method: "GET" }, (d) =>
    IntelCatalogueResponse.parse(d),
  );
}

/** GET /problems/mine — the caller's own submissions and their review state. */
export function fetchMyProblems(token: string): Promise<MyProblemsResponse> {
  return request("/problems/mine", { headers: auth(token) }, (d) =>
    MyProblemsResponse.parse(d),
  );
}

/** GET /problems/mine/:id — one of the caller's own problems, in full. */
export function fetchMyProblem(
  token: string,
  id: string,
): Promise<MyProblemDetail> {
  return request(`/problems/mine/${id}`, { headers: auth(token) }, (d) =>
    MyProblemDetail.parse(d),
  );
}

/**
 * POST /problems/check-duplicate — "does this already exist?".
 *
 * Called as the author types, so the answer arrives before they press submit
 * rather than as a rejection afterwards.
 */
export function checkDuplicate(
  token: string,
  body: DuplicateCheckRequest,
): Promise<DuplicateCheckResponse> {
  return request(
    "/problems/check-duplicate",
    { method: "POST", headers: auth(token), body: JSON.stringify(body) },
    (d) => DuplicateCheckResponse.parse(d),
  );
}

/**
 * POST /problems/submit — send a problem for review.
 *
 * `acknowledgeDuplicate` is the author saying they have seen the near-matches
 * and theirs is different. Without it a near-match comes back as 409.
 */
export function submitProblem(
  token: string,
  input: CommunityProblemInput,
  acknowledgeDuplicate = false,
): Promise<SubmitProblemResponse> {
  const q = acknowledgeDuplicate ? "?acknowledgeDuplicate=true" : "";
  return request(
    `/problems/submit${q}`,
    { method: "POST", headers: auth(token), body: JSON.stringify(input) },
    (d) => SubmitProblemResponse.parse(d),
  );
}

/** PUT /problems/mine/:id — edit a pending or rejected submission. */
export function updateMyProblem(
  token: string,
  id: string,
  input: CommunityProblemInput,
  acknowledgeDuplicate = false,
): Promise<{ id: string }> {
  const q = acknowledgeDuplicate ? "?acknowledgeDuplicate=true" : "";
  return request(`/problems/mine/${id}${q}`, {
    method: "PUT",
    headers: auth(token),
    body: JSON.stringify(input),
  });
}

/** DELETE /problems/mine/:id — withdraw a submission before it goes live. */
export function withdrawMyProblem(token: string, id: string): Promise<void> {
  return request(`/problems/mine/${id}`, {
    method: "DELETE",
    headers: auth(token),
  });
}

/* -------------------------------------------------------------------------- */
/* Leagues                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Reading a league is open, but reads DIFFERENTLY when signed in: the join
 * code and "my leagues" only come back for someone actually involved. So the
 * token is optional on these rather than required, and passing it is what
 * upgrades the response.
 */
function maybeAuth(token?: string | null): Record<string, string> {
  return token ? auth(token) : {};
}

/** GET /leagues — public leagues, plus the caller's own when signed in. */
export function fetchLeagues(token?: string | null): Promise<LeagueListResponse> {
  return request(
    "/leagues",
    { headers: maybeAuth(token) },
    (d) => LeagueListResponse.parse(d),
  );
}

/** GET /leagues/:id — one league's dashboard. */
export function fetchLeague(
  id: string,
  token?: string | null,
): Promise<LeagueDetailResponse> {
  return request(
    `/leagues/${encodeURIComponent(id)}`,
    { headers: maybeAuth(token) },
    (d) => LeagueDetailResponse.parse(d),
  );
}

/** POST /leagues/lookup — resolve a join code. */
export function lookupLeague(
  joinCode: string,
  token?: string | null,
): Promise<LeagueDetailResponse> {
  return request(
    "/leagues/lookup",
    {
      method: "POST",
      headers: maybeAuth(token),
      body: JSON.stringify({ joinCode }),
    },
    (d) => LeagueDetailResponse.parse(d),
  );
}

/** POST /leagues — create one. */
export function createLeague(
  token: string,
  input: CreateLeagueInput,
): Promise<LeagueCard> {
  return request(
    "/leagues",
    { method: "POST", headers: auth(token), body: JSON.stringify(input) },
    (d) => LeagueCard.parse(d),
  );
}

/** PUT /leagues/:id — host edits it. */
export function updateLeague(
  token: string,
  id: string,
  input: UpdateLeagueInput,
): Promise<LeagueCard> {
  return request(
    `/leagues/${encodeURIComponent(id)}`,
    { method: "PUT", headers: auth(token), body: JSON.stringify(input) },
    (d) => LeagueCard.parse(d),
  );
}

/** DELETE /leagues/:id */
export function deleteLeague(token: string, id: string): Promise<void> {
  return request(`/leagues/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: auth(token),
  });
}

/** POST /leagues/:id/teams — found a team. */
export function createLeagueTeam(
  token: string,
  leagueId: string,
  input: CreateTeamInput,
): Promise<LeagueTeamView> {
  return request(
    `/leagues/${encodeURIComponent(leagueId)}/teams`,
    { method: "POST", headers: auth(token), body: JSON.stringify(input) },
    (d) => LeagueTeamView.parse(d),
  );
}

/** POST /leagues/:id/teams/:teamId/join */
export function joinLeagueTeam(
  token: string,
  leagueId: string,
  teamId: string,
): Promise<LeagueTeamView> {
  return request(
    `/leagues/${encodeURIComponent(leagueId)}/teams/${encodeURIComponent(teamId)}/join`,
    { method: "POST", headers: auth(token) },
    (d) => LeagueTeamView.parse(d),
  );
}

/** DELETE /leagues/:id/teams/:teamId/members/:userId — leave or remove. */
export function leaveLeagueTeam(
  token: string,
  leagueId: string,
  teamId: string,
  userId: string,
): Promise<void> {
  return request(
    `/leagues/${encodeURIComponent(leagueId)}/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE", headers: auth(token) },
  );
}

/** GET /leagues/problem-options — problems a host may pin. Titles only. */
export function fetchLeagueProblemOptions(
  token: string,
): Promise<LeagueProblemOptionsResponse> {
  return request(
    "/leagues/problem-options",
    { headers: auth(token) },
    (d) => LeagueProblemOptionsResponse.parse(d),
  );
}

/** POST /leagues/:id/fixtures — schedule a tie. */
export function createLeagueFixture(
  token: string,
  leagueId: string,
  input: CreateFixtureInput,
): Promise<LeagueFixtureView> {
  return request(
    `/leagues/${encodeURIComponent(leagueId)}/fixtures`,
    { method: "POST", headers: auth(token), body: JSON.stringify(input) },
    (d) => LeagueFixtureView.parse(d),
  );
}

/** DELETE /leagues/:id/fixtures/:fixtureId — call a tie off. */
export function cancelLeagueFixture(
  token: string,
  leagueId: string,
  fixtureId: string,
): Promise<void> {
  return request(
    `/leagues/${encodeURIComponent(leagueId)}/fixtures/${encodeURIComponent(fixtureId)}`,
    { method: "DELETE", headers: auth(token) },
  );
}

/**
 * POST .../legs/:legId/start — kick off a leg.
 *
 * Idempotent server-side: a leg already under way returns its existing battle,
 * so a double-click cannot open two rooms for one match.
 */
export function startLeagueLeg(
  token: string,
  leagueId: string,
  fixtureId: string,
  legId: string,
): Promise<StartLegResponse> {
  return request(
    `/leagues/${encodeURIComponent(leagueId)}/fixtures/${encodeURIComponent(fixtureId)}/legs/${encodeURIComponent(legId)}/start`,
    { method: "POST", headers: auth(token) },
    (d) => StartLegResponse.parse(d),
  );
}
