/*
 * TeslaTrace service worker.
 *
 * The point is not "offline support" as a checkbox. It is that this dashboard is
 * read on a phone, in a garage, through a flaky connection, and it should show
 * the last numbers it knew instead of a white screen.
 *
 * Three rules, in order of how much they matter:
 *
 *   shell      network first, fall back to the cached index.html
 *   api        network first, fall back to the cached JSON, marked as such
 *   assets     cache first: their names contain a content hash, so they never
 *              change meaning
 *
 * `__BUILD__` and the precache list are written at build time by scripts/sw.mjs.
 * The build id changes whenever the list or this file changes, which is what
 * makes a deployment visible as an update instead of as a mysterious stale page.
 */

const BUILD = "__BUILD__";
const PRECACHE = __PRECACHE__;

const SHELL_CACHE = `teslatrace-shell-${BUILD}`;
const DATA_CACHE = "teslatrace-data";
const SHELL = "/index.html";

/* A dead-but-routable host would otherwise hang the page for the browser's own
 * default timeout, which is longer than anyone waits before reloading. */
const API_TIMEOUT = 6000;

/* How long a cached API answer waits for the server to beat it. A healthy
 * backend answers in tens of milliseconds; past this, showing yesterday's
 * numbers is better than showing a skeleton. */
const API_GRACE = 1500;

const STALE = Symbol("stale");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // allSettled, not all: one missing icon should not cost the whole shell.
      Promise.allSettled(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      ),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("teslatrace-shell-") && key !== SHELL_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "skip-waiting") {
    self.skipWaiting();
    return;
  }
  // Signing out should leave nothing behind that a next person could read by
  // pulling the network cable out.
  if (data && data.type === "forget-data") {
    event.waitUntil(caches.delete(DATA_CACHE));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // A live stream is a connection, not a document. Intercepting it would turn
  // every reconnect into a cached replay of the first frame.
  if (url.pathname === "/api/v1/stream") return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(apiResponse(event, request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(pageResponse(event, request));
    return;
  }
  event.respondWith(assetResponse(event, request));
});

async function pageResponse(event, request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      // Keep the shell current, so the next offline launch is not last week's.
      event.waitUntil(cache.put(SHELL, response.clone()));
    }
    return response;
  } catch {
    const shell = await cache.match(SHELL);
    if (shell) return shell;
    return new Response("", { status: 503, statusText: "offline" });
  }
}

async function assetResponse(event, request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    event.waitUntil(cache.put(request, response.clone()));
  }
  return response;
}

async function apiResponse(event, request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);

  // Registered before anything is awaited on, so the refresh survives even when
  // the page already has its answer and has moved on.
  const network = timed(request);
  event.waitUntil(
    network
      .then(async (response) => {
        if (response.ok) await cache.put(request, response.clone());
      })
      .catch(() => undefined),
  );

  if (!cached) {
    try {
      return await network;
    } catch {
      return new Response(JSON.stringify({ detail: "offline" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
  }

  // Cached and connected: let the server try to improve on it, but not forever.
  const answer = await Promise.race([
    network.catch(() => STALE),
    new Promise((resolve) => setTimeout(resolve, API_GRACE, STALE)),
  ]);
  if (answer !== STALE) return answer;

  // Say where this came from. The page turns the header into a banner, so stale
  // numbers are never passed off as current ones.
  const headers = new Headers(cached.headers);
  headers.set("x-tt-cache", "hit");
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

function timed(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}
