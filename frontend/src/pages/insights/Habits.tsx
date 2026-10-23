/** Pace, trip length, and how much of the driving is short and therefore thirsty. */

import { Gauge } from "lucide-react";

import { Card, Cap, Tile } from "../../components/ui";
import { durationText } from "../../components/DriveList";
import { num } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Habits as HabitsData } from "../../lib/types";

export function Habits({ habits }: { habits: HabitsData }) {
  const { t } = useI18n();
  if (habits.drives === 0) return null;

  const shortShare = Math.round((habits.short_drives / habits.drives) * 100);
  const nightShare = Math.round((habits.night_drives / habits.drives) * 100);

  return (
    <Card span="half" cols={4}>
      <Cap icon={Gauge} title={t("card.drivingHabits")} aside={`${num(habits.drives)} ${t("kpi.drives")}`} />

      <div className="kpi-value" style={{ fontSize: 30 }}>
        {num(habits.avg_kmh, 1)}
        <span>km/h</span>
      </div>

      <div className="tiles-3" style={{ marginTop: 14 }}>
        <Tile label={t("stats.avgTrip")} value={num(habits.avg_km, 1)} unit="km" />
        <Tile label={t("stats.avgDuration")} value={durationText(habits.avg_minutes, t)} />
        <Tile label={t("stats.daysUsed")} value={num(habits.days_used)} />
      </div>
      <div className="tiles-3" style={{ marginTop: 8 }}>
        <Tile label={t("stats.shortTrips")} value={num(shortShare)} unit="%" />
        <Tile label={t("stats.night")} value={num(nightShare)} unit="%" />
        <Tile label={t("stats.busiestDay")} value={num(habits.busiest_day_km)} unit="km" />
      </div>

      <div className="note">{t("stats.shortNote")}</div>
    </Card>
  );
}
