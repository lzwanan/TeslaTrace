/**
 * Only rendered when the climate actually ran today.
 *
 * Camp mode is the usual reason a parked car still burns energy, and TeslaMate
 * cannot attribute that energy afterwards — the vehicle reports ~0 W while parked.
 * Time is the honest thing to show.
 */

import { Fan } from "lucide-react";

import { Card, Cap } from "../components/ui";
import { durationText } from "../components/DriveList";
import { num } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { Summary } from "../lib/types";

export const CLIMATE_THRESHOLD_HOURS = 0.15;

export function ClimateCard({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  const hours = summary.climate.hours_today;

  return (
    <Card span="half" cols={4}>
      <Cap icon={Fan} title={t("card.climate")} />
      <div className="kpi-value" style={{ fontSize: 30 }}>
        {durationText(Math.round(hours * 60), t)}
      </div>
      <div className="note">{t("card.climateHint")}</div>
      <div className="tiles-3" style={{ marginTop: 14, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="tile">
          <span>{t("kpi.tempIn")}</span>
          <b>
            {num(summary.live.inside_temp, 1)}
            <i>°C</i>
          </b>
        </div>
        <div className="tile">
          <span>{t("kpi.battery")}</span>
          <b>
            {num(summary.live.battery_level)}
            <i>%</i>
          </b>
        </div>
      </div>
    </Card>
  );
}
