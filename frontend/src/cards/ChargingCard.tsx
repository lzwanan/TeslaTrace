/** Charging, whether or not it is happening — the card never disappears, so the grid never reflows. */

import { Zap } from "lucide-react";

import { Card, Cap, Tile } from "../components/ui";
import { durationText } from "../components/DriveList";
import { num } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { Summary } from "../lib/types";

export function ChargingCard({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  const live = summary.live;

  const power = live.charger_power ?? 0;
  const charging = live.state === "charging" || power > 0;
  const limit = live.charge_limit_soc;
  const etaMinutes = live.time_to_full_charge ? Math.round(live.time_to_full_charge * 60) : null;

  return (
    <Card span="half" cols={4}>
      <Cap
        icon={Zap}
        title={t("card.charging")}
        aside={live.plugged_in ? t("kpi.connected") : t("kpi.disconnected")}
      />

      {charging ? (
        <>
          <div className="bigstat num">{`${num(power, 1)} kW`}</div>
          <div className="note">
            {limit ? `${t("chg.eta", { n: num(limit) })}` : t("chg.plugged")}
            {etaMinutes ? ` · ${durationText(etaMinutes, t)}` : ""}
          </div>
          <div className="tiles-3">
            <Tile label={t("chg.added")} value={num(live.charge_energy_added, 1)} unit="kWh" />
            <Tile label={t("chg.target")} value={num(limit)} unit="%" />
            <Tile label={t("chg.toFull")} value={durationText(etaMinutes, t)} />
          </div>
        </>
      ) : (
        <>
          <div className="bigstat">{t("chg.notPlugged")}</div>
          {/* Without MQTT the charge limit is unknown. One full-width tile beats a
              tile that says "—", which reads as a broken number rather than a
              missing one. */}
          <div
            className="tiles-3"
            style={{ marginTop: 14, gridTemplateColumns: `repeat(${limit ? 2 : 1}, minmax(0, 1fr))` }}
          >
            {limit ? <Tile label={t("chg.target")} value={num(limit)} unit="%" /> : null}
            <Tile label={t("kpi.battery")} value={num(live.battery_level)} unit="%" />
          </div>
        </>
      )}
    </Card>
  );
}
