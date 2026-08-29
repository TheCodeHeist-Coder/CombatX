import {
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
export function fetchProblems(token: string): Promise<AdminProblemsResponse> {
  return request("/admin/problems", { headers: auth(token) }, (d) =>
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
