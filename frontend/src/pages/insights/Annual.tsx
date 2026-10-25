/** Year over year: the only view where "is my usage changing" is visible. */

import { CalendarRange } from "lucide-react";

import { Bars } from "../../components/Bars";
import { Card, Cap, Empty, Stat } from "../../components/ui";
import { num } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Yearly } from "../../lib/types";

export function Annual({ yearly }: { yearly: Yearly[] }) {
  const { t } = useI18n();
  const thisYear = new Date().getFullYear();

  if (yearly.length === 0) {
    return (
      <Card span="full" cols={12}>
        <Empty title={t("insight.noData")} />
      </Card>
    );
  }

  const current = yearly[yearly.length - 1];
  // A year-to-date figure must never be compared against a full year: on the
  // reference car that reads "-45%" in October and means nothing.
  const partial = current.year === thisYear;

  return (
    <>
      <Card span="half" cols={4} className="stat-card">
        <Stat
          label={t("insight.thisYear")}
          value={num(current.km)}
          unit="km"
          note={
            partial
              ? `${t("stats.ytd")} · ${num(current.drives)} ${t("kpi.drives")}`
              : `${num(current.drives)} ${t("kpi.drives")}`
          }
        />
      </Card>

      <Card span="full" cols={8}>
        <Cap icon={CalendarRange} title={t("card.annual")} />
        <Bars
          data={yearly.map((year) => ({ label: String(year.year), value: year.km }))}
          format={(value) => num(value)}
        />
      </Card>

      <Card span="full" cols={12}>
        <Cap title={t("insight.breakdown")} />
        <div className="table">
          <div className="table-row head">
            <span>{t("stats.year")}</span>
            <span>{t("card.monthlyKm")}</span>
            <span>{t("stats.kwh")}</span>
            <span>{t("stats.cost")}</span>
          </div>
          {yearly.map((year) => (
            <div className="table-row" key={year.year}>
              <span className="num">
                {year.year}
                {year.year === thisYear ? <i className="ytd">{t("stats.ytd")}</i> : null}
              </span>
              <span className="num">{num(year.km)} km</span>
              <span className="num">{num(year.kwh)} kWh</span>
              <span className="num">{year.cost === null ? "—" : `¥${num(year.cost)}`}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
