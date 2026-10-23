/**
 * Only rendered when something is actually wrong: low charge, unlocked, sentry on.
 * This is the card that proves the registry's `visible` predicate is worth having.
 */

import { ShieldAlert } from "lucide-react";

import { Card, Cap } from "../components/ui";
import { useI18n } from "../lib/i18n";
import type { Summary } from "../lib/types";

export function alertKeys(summary: Summary): string[] {
  const { live } = summary;
  const alerts: string[] = [];
  if ((live.battery_level ?? 100) < 20) alerts.push("alert.lowBattery");
  if (live.locked === false) alerts.push("alert.unlocked");
  if (live.sentry_mode === true) alerts.push("alert.sentry");
  return alerts;
}

export function AlertCard({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  const keys = alertKeys(summary);
  if (keys.length === 0) return null;

  return (
    <Card span="full" cols={12} className="alert-card" tone="amber">
      <Cap icon={ShieldAlert} title={t("card.attention")} />
      <div className="alert-list">
        {keys.map((key) => (
          <span className="pill" key={key} style={{ "--tone": "var(--amber)" } as React.CSSProperties}>
            <i />
            {t(key as "alert.unlocked")}
          </span>
        ))}
      </div>
    </Card>
  );
}
