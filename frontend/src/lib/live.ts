/**
 * Live data comes from one EventSource, not from polling.
 *
 * The first frame is a full snapshot; every frame after it is a patch of the live
 * block. `EventSource` reconnects on its own, so the only job here is to reflect that
 * state in the UI instead of pretending the numbers are always fresh.
 */

import { useEffect, useState, useSyncExternalStore } from "react";

import { streamUrl } from "./api";
import type { LiveState, Summary } from "./types";

export type StreamStatus = "connecting" | "live" | "reconnecting";

const KEY = "teslatrace.summary";

/**
 * The last snapshot, kept on the device.
 *
 * The dashboard's content arrives over SSE, and a stream is deliberately never
 * cached by the service worker: replaying a connection is not the same thing as
 * replaying a document. Without this, an offline launch would draw the shell and
 * then have nothing to put in it.
 *
 * It also buys the online case: the overview paints on the first frame instead
 * of after the handshake.
 */
function readSnapshot(carId: number): Summary | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
      car_id: number;
      summary: Summary;
    } | null;
    return saved?.car_id === carId ? saved.summary : null;
  } catch {
    return null;
  }
}

function writeSnapshot(carId: number, summary: Summary) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ car_id: carId, summary }));
  } catch {
    // A full quota costs a cold start offline, nothing more.
  }
}

/** Signing out should leave no car on the device, cache or not. */
export function clearSnapshot() {
  localStorage.removeItem(KEY);
}

/**
 * `nonce` is the manual refresh: bumping it drops the stream and opens a new one,
 * which re-sends the full snapshot. No polling, no second code path.
 */
export function useSummaryStream(carId: number | undefined, nonce = 0) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<StreamStatus>("connecting");

  useEffect(() => {
    if (!carId) {
      // Signing out drops the car: keeping the last snapshot on screen would leave
      // someone else's dashboard behind the login box.
      setSummary(null);
      setStatus("connecting");
      return;
    }
    // Switching cars must not keep the other car's numbers on screen while the
    // new stream is still connecting.
    setSummary(readSnapshot(carId));
    setStatus("connecting");
    const source = new EventSource(streamUrl(carId));

    const onSnapshot = (event: MessageEvent<string>) => {
      const snapshot = JSON.parse(event.data) as Summary;
      setSummary(snapshot);
      setStatus("live");
      writeSnapshot(carId, snapshot);
    };

    const onPatch = (event: MessageEvent<string>) => {
      const patch = JSON.parse(event.data) as LiveState;
      setSummary((current) =>
        current ? { ...current, live: { ...current.live, ...patch } } : current,
      );
    };

    source.addEventListener("open", () => setStatus("live"));
    source.addEventListener("snapshot", onSnapshot as EventListener);
    source.addEventListener("live", onPatch as EventListener);
    // Browsers retry automatically; showing "reconnecting" beats showing stale numbers
    // as if they were current.
    source.addEventListener("error", () => setStatus("reconnecting"));

    return () => source.close();
  }, [carId, nonce]);

  return { summary, status };
}

let clockTimer: number | undefined;
let clockValue = Date.now();
const clockListeners = new Set<() => void>();

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockTimer === undefined) {
    clockTimer = window.setInterval(() => {
      clockValue = Date.now();
      clockListeners.forEach((notify) => notify());
    }, 1000);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer !== undefined) {
      window.clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}

/** One shared one-second tick for every "N seconds ago" label on screen. */
export function useNow(): number {
  return useSyncExternalStore(subscribeClock, () => clockValue, () => clockValue);
}
