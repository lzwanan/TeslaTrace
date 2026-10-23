/** The four numbers that answer "how much did I use, and is the car okay". */

import { BatteryMedium, CalendarDays, Car, Gauge } from "lucide-react";

import { Card, Kpi } from "../components/ui";
import { num } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { Summary } from "../lib/types";

export function TodayCard({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  const { today_km, today_drives } = summary.driving;
  return (
    <Card span="kpi" cols={3}>
      <Kpi
        icon={Gauge}
        label={t("card.today")}
        value={num(today_km, 1)}
        unit={t("kpi.km")}
        note={`${num(today_drives)} ${t("kpi.drives")}`}
      />
    </Card>
  );
}

export function MonthCard({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  const { month_km, month_drives } = summary.driving;
  return (
    <Card span="kpi" cols={3}>
      <Kpi
        icon={CalendarDays}
        label={t("card.month")}
        value={num(month_km)}
        unit={t("kpi.km")}
        note={`${num(month_drives)} ${t("kpi.drives")}`}
      />
    </Card>
  );
}

export function BatteryCard({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  const { battery_level, charge_limit_soc } = summary.live;
  return (
    <Card span="kpi" cols={3}>
      <Kpi
        icon={BatteryMedium}
        label={t("card.battery")}
        value={num(battery_level)}
        unit="%"
        note={
          charge_limit_soc
            ? `${t("chg.target")} ${num(charge_limit_soc)}%`
            : t("card.battery")
        }
      />
    </Card>
  );
}

export function VehicleCard({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  const { odometer, version } = summary.live;
  return (
    <Card span="kpi" cols={3}>
      <Kpi
        icon={Car}
        label={t("kpi.odometer")}
        value={num(odometer)}
        unit={t("kpi.km")}
        note={version ?? undefined}
      />
    </Card>
  );
}
