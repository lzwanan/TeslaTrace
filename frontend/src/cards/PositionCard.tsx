/** Where the car is. No map SDK, no API key: a coordinate readout plus a deep link. */

import { MapPin } from "lucide-react";

import { Card, Cap, Tile } from "../components/ui";
import { amapLink, num } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { LiveState } from "../lib/types";

export function PositionCard({ live }: { live: LiveState }) {
  const { t } = useI18n();
  const hasFix = live.latitude != null && live.longitude != null;
  const place = live.geofence || t("pos.unknown");

  return (
    <Card span="half" cols={7}>
      <div className="mapface" aria-hidden="true" />
      <div className="z1">
        <Cap icon={MapPin} title={t("card.position")} />

        <div className="bigstat">{place}</div>
        <div className="note num">
          {hasFix
            ? t("pos.coords", { lat: num(live.latitude, 4), lng: num(live.longitude, 4) })
            : t("hero.nowhere")}
        </div>

        <div className="tiles-3" style={{ marginTop: 14, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <Tile label={t("kpi.elevation")} value={num(live.elevation)} unit="m" />
          <Tile label={t("kpi.speed")} value={num(live.speed)} unit="km/h" />
        </div>

        {hasFix ? (
          <a
            className="btn"
            style={{ marginTop: 12 }}
            href={amapLink(live.latitude!, live.longitude!, place)}
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