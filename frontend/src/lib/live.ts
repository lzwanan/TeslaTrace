/**
 * Live data comes from one EventSource, not from polling.
 *
 * The first frame is a full snapshot; every frame after it is a patch of the live
 * block. `EventSource` reconnects on its own, so the only job here is to reflect that
 * state in the UI instead of pretending the numbers are always fresh.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { streamUrl } from "./api";
import type { LiveState, Summary } from "./types";

export type StreamStatus = "connecting" | "live" | "reconnecting";

export function useSummaryStream(carId: number | undefined) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!carId) return;
    setStatus("connecting");
    const source = new EventSource(streamUrl(carId));

    const onSnapshot = (event: MessageEvent<string>) => {
      setSummary(JSON.parse(event.data) as Summary);
      setStatus("live");
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
  }, [carId, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { summary, status, retry };
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
