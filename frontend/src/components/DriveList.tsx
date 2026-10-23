/** One trip row, used by both the overview card and the drives page. */

import { clock, dayLabel, durationParts, num } from "../lib/format";
import { useI18n, type Translate } from "../lib/i18n";
import type { Drive } from "../lib/types";
import { Empty } from "./ui";

export function DriveList({ drives, emptyHint }: { drives: Drive[]; emptyHint?: string }) {
  const { t, locale } = useI18n();
  if (drives.length === 0) return <Empty title={t("recent.empty")} hint={emptyHint} />;

  return (
    <ul className="rows">
      {drives.map((drive) => (
        <li className="drive-row" key={drive.id}>
          <div className="drive-path" aria-hidden="true">
            <span className="dot start" />
            <span className="line" />
            <span className="dot end" />
          </div>
          <div className="drive-body">
            <div className="drive-name">
              <span>{drive.from ?? t("pos.unknown")}</span>
              <span className="arrow">→</span>
              <span>{drive.to ?? t("pos.unknown")}</span>
            </div>
            <div className="drive-meta">
              <span>
                {dayLabel(drive.start_date, locale)} {clock(drive.start_date)}
              </span>
              <span>{durationText(drive.duration_min, t)}</span>
            </div>
          </div>
          <div className="drive-num">
            <b>
              {num(drive.distance_km, 1)}
              <i>km</i>
            </b>
            <span>{clock(drive.end_date)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function durationText(minutes: number | null, t: Translate): string {
  const parts = durationParts(minutes);
  if (!parts) return "—";
  if (parts.hours > 0) {
    return parts.minutes > 0
      ? `${t("time.hourShort", { n: parts.hours })} ${t("time.minShort", { n: parts.minutes })}`
      : t("time.hourShort", { n: parts.hours });
  }
  return t("time.minShort", { n: parts.minutes });
}
