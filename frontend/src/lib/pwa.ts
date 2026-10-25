/**
 * Everything the browser needs to keep this page installed and usable offline.
 *
 * Two independent concerns live here:
 *
 *   useOffline      reads the signal the service worker leaves on cached
 *                   responses, so the page can say "this is old" instead of
 *                   presenting stale numbers as current ones.
 *   useAppUpdate    registers the worker and offers a reload when a new build is
 *                   ready. Never switches on its own: reloading under someone's
 *                   finger, mid-scroll, is worse than being one version behind.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const CACHE_HEADER = "x-tt-cache";

/* -------------------------------------------------------------------------- */
/* offline                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Starting offline is the case that matters: a page reopened in a garage gets
 * no `offline` event, because the connection was already gone when it loaded.
 */
let stale = typeof navigator !== "undefined" && !navigator.onLine;
const listeners = new Set<() => void>();

function publish(next: boolean) {
  if (next === stale) return;
  stale = next;
  for (const listener of listeners) listener();
}

/** Called from api.ts: the service worker answered from its cache. */
export function markFromCache() {
  publish(true);
}

/** Called from api.ts: the network answered, so what is on screen is current. */
export function markFromNetwork() {
  publish(false);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOffline(): boolean {
  useEffect(() => {
    const online = () => publish(false);
    // The browser knows the interface came back; the next request decides
    // whether anything behind it actually answers.
    const offline = () => publish(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  return useSyncExternalStore(subscribe, () => stale, () => false);
}

/* -------------------------------------------------------------------------- */
/* updates                                                                     */
/* -------------------------------------------------------------------------- */

export function useAppUpdate() {
  const [ready, setReady] = useState(false);
  const waiting = useRef<ServiceWorker | null>(null);
  const applying = useRef(false);

  useEffect(() => {
    // In development the worker would cache a build that Vite is rewriting on
    // every save, which produces the exact stale page this file exists to avoid.
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let disposed = false;

    const offer = (worker: ServiceWorker | null) => {
      // Without a controller this is the first install, not an update.
      if (!worker || !navigator.serviceWorker.controller) return;
      waiting.current = worker;
      setReady(true);
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (disposed) return;
        registration = reg;
        offer(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed") offer(installing);
          });
        });
      })
      .catch((error) => {
        // A worker that will not register is not an error worth a banner: the
        // page works exactly as it did before.
        console.warn("service worker not registered", error);
      });

    // An installed app is resumed, not reloaded, so ask on every return.
    const onVisible = () => {
      if (document.visibilityState === "visible") void registration?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);

    const onController = () => {
      if (applying.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onController);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker.removeEventListener("controllerchange", onController);
    };
  }, []);

  const apply = useCallback(() => {
    applying.current = true;
    const worker = waiting.current;
    if (!worker) {
      window.location.reload();
      return;
    }
    worker.postMessage("skip-waiting");
    // If the handover never lands, reload anyway: a prompt that does nothing is
    // worse than a slightly early reload.
    window.setTimeout(() => window.location.reload(), 1200);
  }, []);

  return { ready, apply };
}

/** Signing out should not leave the last car state readable from the disk cache. */
export function forgetCachedData() {
  navigator.serviceWorker?.controller?.postMessage({ type: "forget-data" });
}

export { CACHE_HEADER };
