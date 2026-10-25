/** Six months of distance, cost and the battery estimate. */

import { BatteryMedium, Coins } from "lucide-react";

import { Bars } from "../../components/Bars";
import { Card, Cap, Empty, Stat, Tile } from "../../components/ui";
import { num } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Stats, Summary } from "../../lib/types";

export function Monthly({
  stats,
  summary,
  months,
}: {
  stats: Stats;
  summary: Summary;
  months: number;
}) {
  const { t, locale } = useI18n();
  const { months: series, battery, totals } = stats;

  if (series.length === 0) {
    return (
      <Card span="full" cols={12}>
        <Empty title={t("insight.noData")} />
      </Card>
    );
  }

  const thisMonth = series[series.length - 1];
  const previous = series.length > 1 ? series[series.length - 2] : null;
  const delta =
    previous && previous.km > 0
      ? Math.round(((thisMonth.km - previous.km) / previous.km) * 100)
      : null;

  const hasCost = series.some((month) => month.cost !== null);
  const perKm = totals.km > 0 && totals.cost > 0 ? totals.cost / totals.km : null;

  const monthLabel = (month: string) => {
    const [year, index] = month.split("-");
    return new Date(Number(year), Number(index) - 1, 1).toLocaleDateString(locale, {
      month: "short",
    });
  };
  const labels = series.map((month) => monthLabel(month.month));

  return (
    <>
      <Card span="half" cols={4} className="stat-card">
        <Stat
          label={t("insight.thisMonthKm")}
          value={num(thisMonth.km)}
          unit="km"
          note={
            <>
              {num(thisMonth.drives)} {t("kpi.drives")}
              {delta === null
                ? null
                : ` · ${t("insight.vsLastMonth")} ${delta > 0 ? "+" : ""}${delta}%`}
            </>
          }
        />
      </Card>

      <Card span="full" cols={8}>
        <Cap title={t("card.monthlyKm")} aside={t("card.totals", { n: months })} />
        <Bars
          data={series.map((month, index) => ({ label: labels[index], value: month.km }))}
          format={(value) => num(value)}
        />
        <div className="note">
          {num(totals.km)} km · {num(totals.drives)} {t("kpi.drives")}
        </div>
      </Card>

      <Card span="half" cols={6}>
        <Cap icon={Coins} title={t("card.totals", { n: months })} />
        {hasCost ? (
          <>
            <div className="kpi-value" style={{ fontSize: 30 }}>
              ¥{num(totals.cost, 2)}
            </div>
            <div className="note">{t("stats.includesParked")}</div>
            <div
              className="tiles-3"
              style={{ marginTop: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
            >
              <Tile label={t("stats.kwh")} value={num(totals.kwh)} unit="kWh" />
              <Tile label={t("stats.perKm")} value={perKm ? `¥${num(perKm, 2)}` : "—"} />
            </div>
          </>
        ) : (
          <Empty title={t("stats.noCost")} />
        )}
      </Card>

      <Card span="half" cols={6}>
        <Cap icon={BatteryMedium} title={t("card.capacity")} />
        <div className="kpi-value" style={{ fontSize: 30 }}>
          {num(battery.capacity_kwh, 1)}
          <span>kWh</span>
        </div>
        <div className="note">{t("stats.samples", { n: battery.samples })}</div>
        <div
          className="tiles-3"
          style={{ marginTop: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
        >
          <Tile label={t("stats.ratedRange")} value={num(battery.rated_range_km)} unit="km" />
          <Tile label={t("stats.current")} value={num(summary.live.battery_level)} unit="%" />
        </div>
      </Card>
    </>
  );
}
