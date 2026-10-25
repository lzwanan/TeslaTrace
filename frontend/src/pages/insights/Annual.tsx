/** Year over year: the only view where "is my usage changing" is visible. */

import { CalendarRange } from "lucide-react";

import { Bars } from "../../components/Bars";
import { Card, Cap } from "../../components/ui";
import { num } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Yearly } from "../../lib/types";

export function Annual({ yearly }: { yearly: Yearly[] }) {
  const { t } = useI18n();
  if (yearly.length === 0) return null;

  const current = yearly[yearly.length - 1];
  const previous = yearly.length > 1 ? yearly[yearly.length - 2] : null;
  // A year-to-date figure must never be compared against a full year: on the
  // reference car that reads "-45%" in October and means nothing.
  const partial = current.year === new Date().getFullYear();
  const delta =
    !partial && previous && previous.km > 0
      ? Math.round(((current.km - previous.km) / previous.km) * 100)
      : null;

  return (
    <Card span="full" cols={12} id="sec-year">
      <Cap
        icon={CalendarRange}
        title={t("card.annual")}
        aside={delta === null ? null : `${delta > 0 ? "+" : ""}${delta}%`}
      />

      <Bars
        data={yearly.map((year) => ({ label: String(year.year), value: year.km }))}
        format={(value) => `${num(value)} km`}
      />

      <div className="table" style={{ marginTop: 14 }}>
        <div className="table-row head">
          <span>{t("stats.year")}</span>
          <span>{t("card.monthlyKm")}</span>
          <span>{t("stats.kwh")}</span>
          <span>{t("stats.cost")}</span>
          <span>{t("stats.avgTrip")}</span>
        </div>
        {yearly.map((year) => (
          <div className="table-row" key={year.year}>
            <span className="num">
              {year.year}
              {year.year === new Date().getFullYear() ? (
                <i className="ytd">{t("stats.ytd")}</i>
              ) : null}
            </span>
            <span className="num">{num(year.km)} km</span>
            <span className="num">{num(year.kwh)} kWh</span>
            <span className="num">{year.cost === null ? "—" : `¥${num(year.cost)}`}</span>
            <span className="num">{num(year.avg_km, 1)} km</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
