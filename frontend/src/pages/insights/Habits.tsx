/** Pace, trip length, and how much of the driving is short and therefore thirsty. */

import { Gauge, Ruler } from "lucide-react";

import { Dist } from "../../components/Dist";
import { Card, Cap, Empty, Stat, Tile } from "../../components/ui";
import { num } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Habits as HabitsData } from "../../lib/types";

export function Habits({ habits }: { habits: HabitsData }) {
  const { t } = useI18n();

  if (habits.drives === 0) {
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
          label={t("stats.avgTrip")}
          value={num(habits.avg_km, 1)}
          unit="km"
          note={`${num(habits.drives)} ${t("kpi.drives")} · ${t("stats.avgSpeed")} ${num(
            habits.avg_kmh,
            1,
          )} km/h`}
        />
      </Card>

      <Card span="full" cols={8}>
        <Cap icon={Ruler} title={t("insight.tripLengths")} />
        <Dist items={habits.lengths} labelOf={(key) => t(`stats.len.${key}` as "stats.len.lt5")} />
        <div className="note">{t("stats.shortNote")}</div>
      </Card>

      <Card span="full" cols={12}>
        <Cap icon={Gauge} title={t("insight.usage")} />
        <div className="tiles-4" style={{ marginTop: 2 }}>
          <Tile label={t("stats.daysUsed")} value={num(habits.days_used)} />
          <Tile label={t("stats.busiestDay")} value={num(habits.busiest_day_km)} unit="km" />
          <Tile label={t("stats.longestTrip")} value={num(habits.longest_km, 1)} unit="km" />
          <Tile label={t("stats.night")} value={num(Math.round((habits.night_drives / habits.drives) * 100))} unit="%" />
        </div>
      </Card>
    </>
  );
}
