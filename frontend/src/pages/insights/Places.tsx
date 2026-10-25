/** Where the car actually goes. Geofences only — unnamed trips are skipped. */

import { Card, Empty, Stat } from "../../components/ui";
import { num } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Place } from "../../lib/types";

export function Places({ places }: { places: Place[] }) {
  const { t } = useI18n();

  if (places.length === 0) {
    return (
      <Card span="full" cols={12}>
        <Empty title={t("insight.noData")} />
      </Card>
    );
  }

  const top = places[0];
  const max = Math.max(...places.map((place) => place.visits));

  return (
    <>
      <Card span="half" cols={4} className="stat-card">
        <Stat
          label={t("insight.topPlace")}
          value={top.name}
          size="text"
          note={`${num(top.visits)} ${t("stats.visits")}`}
        />
      </Card>

      {/* No card title: the section heading already says what this list is, and
          repeating "Frequent places" above a list of places is noise. */}
      <Card span="full" cols={8}>
        <ul className="places">
          {places.map((place) => (
            <li key={place.name}>
              {/* Names wrap instead of truncating: "华为练秋湖研发…" is not a place. */}
              <span className="pl-name">{place.name}</span>
              <span className="dbar">
                <i style={{ width: `${Math.round((place.visits / max) * 100)}%` }} />
              </span>
              <em>{num(place.visits)}</em>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
