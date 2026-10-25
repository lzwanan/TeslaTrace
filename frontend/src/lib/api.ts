/**
 * The only place that knows the API exists.
 *
 * Authentication is a cookie the browser stores for us. Nothing about the token
 * lives in JavaScript: it is exchanged once for an HttpOnly session cookie, so a
 * script on the page cannot read it, and `EventSource` gets it for free without
 * the token ever appearing in a URL.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Session = { required: boolean; authenticated: boolean };

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`/api/v1${path}`, { credentials: "same-origin", ...init });
  if (!response.ok) {
    throw new ApiError(response.status, await response.text().catch(() => response.statusText));
  }
  return response;
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await call(path, { signal, headers: { accept: "application/json" } });
  return (await response.json()) as T;
}

export const session = {
  get: (): Promise<Session> => apiGet<Session>("/session"),

  open: async (token: string): Promise<void> => {
    await call("/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
  },

  close: async (): Promise<void> => {
    await call("/session", { method: "DELETE" });
  },
};

export function streamUrl(carId?: number): string {
  const params = new URLSearchParams();
  if (carId) params.set("car_id", String(carId));
  const query = params.toString();
  return `/api/v1/stream${query ? `?${query}` : ""}`;
}
