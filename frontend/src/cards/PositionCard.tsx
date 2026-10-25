/** Where the car is. No map SDK, no API key: a coordinate readout plus a deep link. */

import { MapPin } from "lucide-react";

import { Card, Cap, Tile } from "../components/ui";
import { amapLink, num } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { LiveState } from "../lib/types";

export function PositionCard({ live }: { live: LiveState }) {
  const { t } = useI18n();
  const hasFix = live.latitude != null && live.longitude != null;
  const coords = hasFix
    ? t("pos.coords", { lat: num(live.latitude, 4), lng: num(live.longitude, 4) })
    : null;

  // Without a geofence match there is still a perfectly good answer: the
  // coordinates. Putting "unknown place" in 32px over a known position is the
  // one thing this card should never do.
  const headline = live.geofence ?? coords ?? t("pos.unknown");
  const note = live.geofence ? coords : hasFix ? t("pos.outside") : t("hero.nowhere");

  return (
    <Card span="half" cols={7}>
      <div className="mapface" aria-hidden="true" />
      <div className="z1">
        <Cap icon={MapPin} title={t("card.position")} />

        <div className={`bigstat${live.geofence ? "" : " sm"}`}>{headline}</div>
        <div className="note num">{note}</div>

        <div className="tiles-3" style={{ marginTop: 14, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <Tile label={t("kpi.elevation")} value={num(live.elevation)} unit="m" />
          <Tile label={t("kpi.speed")} value={num(live.speed)} unit="km/h" />
        </div>

        {hasFix ? (
          <a
            className="btn"
            style={{ marginTop: 12 }}
            href={amapLink(live.latitude!, live.longitude!, headline)}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t("pos.open")}
          </a>
        ) : null}
      </div>
    </Card>
  );
}