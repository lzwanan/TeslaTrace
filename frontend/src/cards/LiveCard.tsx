/**
 * The hero: state of charge, range, where the car is. One screen, three answers.
 *
 * The third line doubles as a climate indicator. Camp mode is why a parked car
 * still draws power, and TeslaMate cannot attribute that energy afterwards (the
 * vehicle reports ~0 W while parked), so at least the state is visible live.
 */

import { Fan } from "lucide-react";

import { Ring } from "../components/Ring";
import { stateTone } from "../components/StatePill";
import { Card } from "../components/ui";
import { num } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { CSSProperties } from "react";

import type { Summary } from "../lib/types";

export function LiveCard({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  const { live, car } = summary;

  const soc = live.battery_level ?? 0;
  const range = live.rated_battery_range_km ?? live.est_battery_range_km ?? null;
  const limit = live.charge_limit_soc ?? null;

  // Same chain as the position card: a geofence name, else the fact that we do
  // have a fix, else the truth. "Location unknown" over known coordinates reads
  // as a bug.
  const hasFix = live.latitude != null && live.longitude != null;
  const where = live.geofence
    ? t("hero.parked", { place: live.geofence })
    : hasFix
      ? t("pos.outside")
      : t("hero.nowhere");

  return (
    <Card span="full" cols={5} className="hero" tone={heroTone(live.state)}>
      <div className="hero-in">
        <Ring value={soc} tone={stateTone(live.state)}>
          <b className="num">
            {num(soc)}
            <span>%</span>
          </b>
          <span>{limit ? t("hero.target", { n: num(limit) }) : car.label}</span>
        </Ring>

        <div className="hero-meta">
          <div className="range">
            <b className="num">{num(range)}</b>
            <span>km</span>
            <em>{t("hero.range")}</em>
          </div>
          <div className="hero-sub">{where}</div>
          {live.is_climate_on ? (
            <span className="pill" style={{ "--tone": "var(--blue)", height: 24, fontSize: 11 } as CSSProperties}>
              <Fan size={13} style={{ marginLeft: -2 }} />
              {t("kpi.climate")}
              {live.inside_temp != null ? ` · ${num(live.inside_temp, 1)}°C` : ""}
            </span>
          ) : (
            <div className="hero-sub dim">{car.label}</div>
          )}
        </div>
      </div>

      <div className="hero-foot">
        <div>
          <span>{t("kpi.tempIn")}</span>
          <b className="num">
            {num(live.inside_temp, 1)}
            <i>°C</i>
          </b>
        </div>
        <div>
          <span>{t("kpi.tempOut")}</span>
          <b className="num">
            {num(live.outside_temp, 1)}
            <i>°C</i>
          </b>
        </div>
        <div>
          <span>{t("kpi.odometer")}</span>
          <b className="num">
            {num(live.odometer)}
            <i>km</i>
          </b>
        </div>
      </div>
    </Card>
  );
}

function heroTone(state: string | undefined): "green" | "blue" | "amber" | "red" | "muted" {
  switch (state) {
    case "charging":
      return "green";
    case "driving":
    case "online":
      return "blue";
    case "error":
      return "red";
    case "updating":
      return "amber";
    default:
      return "muted";
  }
}
