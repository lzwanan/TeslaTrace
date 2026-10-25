/** Six months of distance, cost and the battery estimate. */

import { BatteryMedium, Coins, TrendingUp } from "lucide-react";

import { Bars } from "../../components/Bars";
import { Card, Cap, Empty, Tile } from "../../components/ui";
import { num } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Stats, Summary } from "../../lib/types";

export function Monthly({ stats, summary, months }: { stats: Stats; summary: Summary; months: number }) {
  const { t, locale } = useI18n();
  const { months: series, battery, totals } = stats;

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
      <Card span="full" cols={8} id="sec-month">
        <Cap icon={TrendingUp} title={t("card.monthlyKm")} aside={t("card.totals", { n: months })} />
        <Bars
          data={series.map((month, index) => ({ label: labels[index], value: month.km }))}
          format={(value) => `${num(value)} km`}
        />
        <div className="note">
          {num(totals.km)} km · {num(totals.drives)} {t("kpi.drives")}
        </div>
      </Card>

      <Card span="half" cols={4}>
        <Cap icon={Coins} title={t("card.totals", { n: months })} />
        <div className="kpi-value" style={{ fontSize: 32 }}>
          ¥{num(totals.cost, 2)}
        </div>
        <div className="note">
          {hasCost ? t("stats.sessions", { n: totals.costed }) : t("stats.noCost")}
        </div>
        <div className="tiles-3" style={{ marginTop: 14 }}>
          <Tile label={t("stats.kwh")} value={num(totals.kwh)} unit="kWh" />
          <Tile label={t("stats.perKm")} value={perKm ? `¥${num(perKm, 2)}` : "—"} />
          <Tile label={t("card.monthlyKm")} value={num(totals.km)} unit="km" />
        </div>
      </Card>

      <Card span="full" cols={8}>
        <Cap icon={TrendingUp} title={t("card.monthlyCost")} />
        {hasCost ? (
          <Bars
            data={series.map((month, index) => ({ label: labels[index], value: month.cost }))}
            format={(value) => `¥${num(value, 2)}`}
          />
        ) : (
          <Empty title={t("stats.noCost")} />
        )}
        <div className="note">
          {hasCost && perKm
            ? `${t("stats.perKm")} ¥${num(perKm, 2)} · ${t("stats.includesParked")}`
            : t("stats.noCost")}
        </div>
      </Card>

      <Card span="half" cols={4}>
        <Cap icon={BatteryMedium} title={t("card.capacity")} />
        <div className="kpi-value" style={{ fontSize: 32 }}>
          {num(battery.capacity_kwh, 1)}
          <span>kWh</span>
        </div>
        <div className="note">{t("stats.samples", { n: battery.samples })}</div>
        <div
          className="tiles-3"
          style={{ marginTop: 14, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
        >
          <Tile label={t("stats.ratedRange")} value={num(battery.rated_range_km)} unit="km" />
          <Tile label={t("stats.current")} value={num(summary.live.battery_level)} unit="%" />
        </div>
      </Card>
    </>
  );
}
