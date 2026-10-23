/** Where the car actually goes. Geofences only — unnamed trips are skipped. */

import { MapPin } from "lucide-react";

import { Card, Cap } from "../../components/ui";
import { num } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Place } from "../../lib/types";

export function Places({ places }: { places: Place[] }) {
  const { t } = useI18n();
  if (places.length === 0) return null;

  const max = Math.max(...places.map((place) => place.visits));

  return (
    <Card span="half" cols={4}>
      <Cap icon={MapPin} title={t("card.places")} />
      <ul className="dist">
        {places.map((place) => (
          <li key={place.name}>
            <span className="label" title={place.name} style={{ width: 104 }}>
              {place.name}
            </span>
            <span className="dbar">
              <i style={{ width: `${Math.round((place.visits / max) * 100)}%` }} />
            </span>
            <em>{num(place.visits)}</em>
          </li>
        ))}
      </ul>
      <div className="note">{t("stats.visits")}</div>
    </Card>
  );
}
