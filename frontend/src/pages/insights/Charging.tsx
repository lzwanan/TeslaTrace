/** What the pack is charged to, and when the cable goes in. */

import { PlugZap } from "lucide-react";

import { Card, Cap, Tile } from "../../components/ui";
import { num } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { ChargingProfile, Distribution } from "../../lib/types";

export function Charging({ profile }: { profile: ChargingProfile }) {
  const { t } = useI18n();
  if (profile.sessions === 0) return null;

  return (
    <Card span="half" cols={4} id="sec-charging">
      <Cap icon={PlugZap} title={t("card.chargingHabits")} aside={t("stats.sessions", { n: profile.sessions })} />

      <Dist
        title={t("stats.chargedTo")}
        items={profile.levels}
        labelOf={(key) => t(`stats.level.${key}` as "stats.level.full")}
      />
      <Dist
        title={t("stats.startedAt")}
        items={profile.hours}
        labelOf={(key) => t(`stats.hour.${key}` as "stats.hour.night")}
      />

      <div className="tiles-3" style={{ marginTop: 12 }}>
        <Tile label={t("stats.avgPower")} value={num(profile.avg_kw, 1)} unit="kW" />
        <Tile label={t("stats.avgDuration")} value={num(profile.avg_minutes)} unit={t("kpi.minutes")} />
        <Tile label={t("stats.maxKwh")} value={num(profile.max_kwh, 1)} unit="kWh" />
      </div>

      <div className="note">{t("stats.lfpNote")}</div>
    </Card>
  );
}

/** A tiny horizontal bar list — reused for any {key, value} distribution. */
export function Dist({
  title,
  items,
  labelOf,
}: {
  title: string;
  items: Distribution[];
  labelOf: (key: string) => string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <div style={{ marginTop: 12 }}>
      <div className="dist-title">{title}</div>
      <ul className="dist">
        {items.map((item) => (
          <li key={item.key}>
            <span className="label">{labelOf(item.key)}</span>
            <span className="dbar">
              <i style={{ width: `${Math.round((item.value / max) * 100)}%` }} />
            </span>
            <em>{Math.round((item.value / total) * 100)}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
