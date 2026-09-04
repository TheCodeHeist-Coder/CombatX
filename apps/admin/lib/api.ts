import {
  AdminBadgesResponse,
  AdminBadgePreviewResponse,
  AdminBadgeRecalcResponse,
  type AdminBadgeCondition,
  type AdminBadgeCreate,
  type AdminBadgeInput,
  AdminBattlesResponse,
  AdminLoginResponse,
  AdminOverviewResponse,
  AdminProblemDetail,
  AdminProblemsResponse,
  AdminUsersResponse,
  type AdminProblemInput,
} from "@repo/protocol";
import { API_URL } from "./config";
import { clearAdminSession } from "./session";

/** A failed admin API call, carrying the server's code where available. */
export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
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
    throw new AdminApiError("Can't reach the API.", "NETWORK", 0);
  }

  if (res.status === 204) return undefined as T;

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    // A 401 means the token is gone, expired, or the account was demoted.
    // Drop it here so the app falls back to the login screen instead of
    // retrying with a credential the server has already rejected.
    if (res.status === 401) clearAdminSession();
    const err = body as { code?: string; message?: string } | null;
    throw new AdminApiError(
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

/** POST /admin/login */
export function adminLogin(
  email: string,
  password: string,
): Promise<AdminLoginResponse> {
  return request(
    "/admin/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    (d) => AdminLoginResponse.parse(d),
  );
}

/** GET /admin/overview */
export function fetchOverview(token: string): Promise<AdminOverviewResponse> {
  return request("/admin/overview", { headers: auth(token) }, (d) =>
    AdminOverviewResponse.parse(d),
  );
}

/** GET /admin/users */
export function fetchUsers(
  token: string,
  opts: { q?: string; limit?: number; offset?: number } = {},
): Promise<AdminUsersResponse> {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  params.set("limit", String(opts.limit ?? 50));
  params.set("offset", String(opts.offset ?? 0));
  return request(`/admin/users?${params}`, { headers: auth(token) }, (d) =>
    AdminUsersResponse.parse(d),
  );
}

/** GET /admin/battles */
export function fetchBattles(
  token: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<AdminBattlesResponse> {
  const params = new URLSearchParams({
    limit: String(opts.limit ?? 50),
    offset: String(opts.offset ?? 0),
  });
  return request(`/admin/battles?${params}`, { headers: auth(token) }, (d) =>
    AdminBattlesResponse.parse(d),
  );
}

/** GET /admin/problems */
export function fetchProblems(
  token: string,
  status?: string,
): Promise<AdminProblemsResponse> {
  const q = status && status !== "ALL" ? `?status=${status}` : "";
  return request(`/admin/problems${q}`, { headers: auth(token) }, (d) =>
    AdminProblemsResponse.parse(d),
  );
}

/** GET /admin/problems/:id */
export function fetchProblem(
  token: string,
  id: string,
): Promise<AdminProblemDetail> {
  return request(`/admin/problems/${id}`, { headers: auth(token) }, (d) =>
    AdminProblemDetail.parse(d),
  );
}

/** POST /admin/problems */
export function createProblem(
  token: string,
  input: AdminProblemInput,
): Promise<{ id: string }> {
  return request("/admin/problems", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify(input),
  });
}

/** PUT /admin/problems/:id */
export function updateProblem(
  token: string,
  id: string,
  input: AdminProblemInput,
): Promise<{ id: string }> {
  return request(`/admin/problems/${id}`, {
    method: "PUT",
    headers: auth(token),
    body: JSON.stringify(input),
  });
}

/** DELETE /admin/problems/:id */
export function deleteProblem(token: string, id: string): Promise<void> {
  return request(`/admin/problems/${id}`, {
    method: "DELETE",
    headers: auth(token),
  });
}

// --- Badge rules -----------------------------------------------------------

/** GET /admin/badges */
export function fetchBadges(token: string): Promise<AdminBadgesResponse> {
  return request("/admin/badges", { headers: auth(token) }, (d) =>
    AdminBadgesResponse.parse(d),
  );
}

/** POST /admin/badges — define a new badge. Returns the refreshed table. */
export function createBadge(
  token: string,
  input: AdminBadgeCreate,
): Promise<AdminBadgesResponse> {
  return request(
    "/admin/badges",
    { method: "POST", headers: auth(token), body: JSON.stringify(input) },
    (d) => AdminBadgesResponse.parse(d),
  );
}

/** PUT /admin/badges/:key — edit everything except the key. */
export function updateBadge(
  token: string,
  key: string,
  input: AdminBadgeInput,
): Promise<AdminBadgesResponse> {
  return request(
    `/admin/badges/${encodeURIComponent(key)}`,
    { method: "PUT", headers: auth(token), body: JSON.stringify(input) },
    (d) => AdminBadgesResponse.parse(d),
  );
}

/** DELETE /admin/badges/:key — refused while anyone holds it. */
export function deleteBadge(
  token: string,
  key: string,
): Promise<AdminBadgesResponse> {
  return request(
    `/admin/badges/${encodeURIComponent(key)}`,
    { method: "DELETE", headers: auth(token) },
    (d) => AdminBadgesResponse.parse(d),
  );
}

/** POST /admin/badges/seed — restore any missing shipped defaults. */
export function seedBadges(token: string): Promise<AdminBadgesResponse> {
  return request(
    "/admin/badges/seed",
    { method: "POST", headers: auth(token) },
    (d) => AdminBadgesResponse.parse(d),
  );
}

/** POST /admin/badges/preview — how many players would these conditions match? */
export function previewBadge(
  token: string,
  conditions: AdminBadgeCondition[],
): Promise<AdminBadgePreviewResponse> {
  return request(
    "/admin/badges/preview",
    {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ conditions }),
    },
    (d) => AdminBadgePreviewResponse.parse(d),
  );
}

/** POST /admin/badges/recalculate — re-apply every rule to every player. */
export function recalculateBadges(
  token: string,
): Promise<AdminBadgeRecalcResponse> {
  return request(
    "/admin/badges/recalculate",
    { method: "POST", headers: auth(token) },
    (d) => AdminBadgeRecalcResponse.parse(d),
  );
}

/** POST /admin/problems/:id/approve — publish a submission. */
export function approveProblem(
  token: string,
  id: string,
): Promise<{ id: string; status: string; awarded: { key: string; label: string; count: number; isNew: boolean }[] }> {
  return request(`/admin/problems/${id}/approve`, {
    method: "POST",
    headers: auth(token),
  });
}

/** POST /admin/problems/:id/reject — send it back with a reason. */
export function rejectProblem(
  token: string,
  id: string,
  reviewNote: string,
): Promise<{ id: string; status: string }> {
  return request(`/admin/problems/${id}/reject`, {
    method: "POST",
    headers: { ...auth(token), "content-type": "application/json" },
    body: JSON.stringify({ reviewNote }),
  });
}
