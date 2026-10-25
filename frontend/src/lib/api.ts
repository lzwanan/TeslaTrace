/**
 * The only place that knows the API exists.
 *
 * Authentication is a cookie the browser stores for us. The password is posted
 * exactly once, to exchange for an HttpOnly session cookie, so no secret ever
 * lives in JavaScript or in a URL.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Session = {
  /** true when a username and password have been set up. */
  required: boolean;
  authenticated: boolean;
  username: string | null;
  /** Still the shipped admin/admin: worth nagging about until changed. */
  default_password: boolean;
};

export type AuthChange = {
  enabled: boolean;
  username?: string;
  new_password?: string;
  current_password?: string;
};

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`/api/v1${path}`, { credentials: "same-origin", ...init });
  if (!response.ok) {
    throw new ApiError(response.status, await response.text().catch(() => response.statusText));
  }
  return response;
}

function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return call(path, {
    method,
    headers: body === undefined ? { accept: "application/json" } : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (response) => {
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  });
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return call(path, { signal, headers: { accept: "application/json" } }).then(
    (response) => response.json() as Promise<T>,
  );
}

export const session = {
  get: (): Promise<Session> => apiGet<Session>("/session"),

  open: async (username: string, password: string): Promise<void> => {
    await call("/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  },

  close: async (): Promise<void> => {
    await call("/session", { method: "DELETE" });
  },
};

export const settings = {
  saveAuth: (change: AuthChange): Promise<Session> => send<Session>("/settings/auth", "PUT", change),
};

export function streamUrl(carId?: number): string {
  const params = new URLSearchParams();
  if (carId) params.set("car_id", String(carId));
  const query = params.toString();
  return `/api/v1/stream${query ? `?${query}` : ""}`;
}
