/**
 * The status capsule.
 *
 * This is the piece that makes a frozen dashboard honest: when TeslaMate stops
 * polling because the car is asleep, the pill says so and for how long. Without it,
 * every stale number looks like a bug.
 */

import type { CSSProperties } from "react";

import { ageParts, sinceSeconds } from "../lib/format";
import { useI18n, type Translate } from "../lib/i18n";
import type { LiveState } from "../lib/types";

const TONES: Record<string, string> = {
  charging: "var(--green)",
  driving: "var(--blue)",
  online: "var(--blue)",
  updating: "var(--amber)",
  error: "var(--red)",
  asleep: "var(--t3)",
  offline: "var(--t3)",
};

const KNOWN = ["charging", "driving", "online", "asleep", "offline", "updating", "error"] as const;
type KnownState = (typeof KNOWN)[number];

export function stateTone(state: string | undefined): string {
  return TONES[state ?? ""] ?? "var(--t3)";
}

function stateKey(state: string | undefined): KnownState | "unknown" {
  return KNOWN.includes(state as KnownState) ? (state as KnownState) : "unknown";
}

export function StatePill({ live, now }: { live: LiveState; now: number }) {
  const { t } = useI18n();
  const key = stateKey(live.state);
  const resting = key === "asleep" || key === "offline";
  const elapsed = resting ? sinceSeconds(live.since, now) : null;

  return (
    <span className="pill" style={{ "--tone": stateTone(live.state) } as CSSProperties}>
      <i />
      {t(`state.${key}`)}
      {elapsed !== null && elapsed > 60 ? ` · ${humanAge(elapsed, t)}` : null}
    </span>
  );
}

export function humanAge(seconds: number, t: Translate): string {
  const { unit, n } = ageParts(seconds);
  return t(`time.${unit}`, { n });
}
