/**
 * The only place that knows the API exists.
 *
 * When the backend runs with AUTH_TOKEN set, the browser has to send it. EventSource
 * cannot set headers, so the token also travels as a query parameter on /stream.
 */

const TOKEN_KEY = "teslatrace.token";

export const authToken = {
  get: (): string => localStorage.getItem(TOKEN_KEY) ?? "",
  set: (value: string): void => {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const headers = new Headers({ accept: "application/json" });
  const token = authToken.get();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(`/api/v1${path}`, { headers, signal });
  if (!response.ok) {
    throw new ApiError(response.status, await response.text().catch(() => response.statusText));
  }
  return (await response.json()) as T;
}

export function streamUrl(carId?: number): string {
  const params = new URLSearchParams();
  const token = authToken.get();
  if (token) params.set("token", token);
  if (carId) params.set("car_id", String(carId));
  const query = params.toString();
  return `/api/v1/stream${query ? `?${query}` : ""}`;
}
