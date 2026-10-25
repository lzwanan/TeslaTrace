/** How full the pack is charged to, and when the cable goes in. */

import { Clock, PlugZap, Zap } from "lucide-react";

import { Dist } from "../../components/Dist";
import { Card, Cap, Empty, Stat, Tile } from "../../components/ui";
import { num } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { ChargingProfile } from "../../lib/types";

export function Charging({ profile }: { profile: ChargingProfile }) {
  const { t } = useI18n();

  if (profile.sessions === 0) {
    return (
      <Card span="full" cols={12}>
        <Empty title={t("insight.noData")} />
      </Card>
    );
  }

  return (
    <>
      <Card span="half" cols={4} className="stat-card">
        <Stat
          label={t("stats.avgPower")}
          value={num(profile.avg_kw, 1)}
          unit="kW"
          note={`${t("stats.sessions", { n: profile.sessions })} · ${num(profile.avg_minutes)} ${t(
            "kpi.minutes",
          )}`}
        />
      </Card>

      <Card span="full" cols={8}>
        <Cap icon={PlugZap} title={t("stats.chargedTo")} />
        <Dist items={profile.levels} labelOf={(key) => t(`stats.level.${key}` as "stats.level.full")} />
        <div className="note">{t("stats.lfpNote")}</div>
      </Card>

      <Card span="half" cols={6}>
        <Cap icon={Clock} title={t("stats.startedAt")} />
        <Dist items={profile.hours} labelOf={(key) => t(`stats.hour.${key}` as "stats.hour.night")} />
      </Card>

      <Card span="half" cols={6}>
        <Cap icon={Zap} title={t("insight.perSession")} />
        <div
          className="tiles-3"
          style={{ marginTop: 2, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
        >
          <Tile
            label={t("stats.avgDuration")}
            value={num(profile.avg_minutes)}
            unit={t("kpi.minutes")}
          />
          <Tile label={t("stats.maxKwh")} value={num(profile.max_kwh, 1)} unit="kWh" />
        </div>
      </Card>
    </>
  );
}
