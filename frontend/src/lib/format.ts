/** Formatting only. Units and words come from the translator, numbers from here. */

export const DASH = "—";

export function num(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function clock(iso: string | null | undefined): string {
  if (!iso) return DASH;
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function dayLabel(iso: string | null | undefined, locale: string): string {
  if (!iso) return DASH;
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) return "";
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

/** "2 小时 10 分" is composed by the caller; this returns the pieces. */
export function durationParts(totalMinutes: number | null | undefined) {
  if (!totalMinutes || totalMinutes < 0) return null;
  const minutes = Math.round(totalMinutes);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

export function ageSeconds(timestamp: number | undefined, now: number): number | null {
  if (!timestamp) return null;
  return Math.max(0, Math.round(now / 1000 - timestamp));
}

export function sinceSeconds(iso: string | undefined, now: number): number | null {
  if (!iso) return null;
  const started = Date.parse(iso);
  if (Number.isNaN(started)) return null;
  return Math.max(0, Math.round((now - started) / 1000));
}

/** TeslaMate stores WGS-84; the AMap URI scheme needs to be told that explicitly. */
/** Picks the unit and the number; the words come from the dictionary. */
export type AgePart = { unit: "sec" | "min" | "hour" | "day"; n: number };

export function ageParts(seconds: number): AgePart {
  if (seconds < 60) return { unit: "sec", n: Math.max(1, Math.round(seconds)) };
  if (seconds < 3600) return { unit: "min", n: Math.round(seconds / 60) };
  if (seconds < 86400) return { unit: "hour", n: Math.round(seconds / 3600) };
  return { unit: "day", n: Math.round(seconds / 86400) };
}

export function amapLink(lat: number, lng: number, name: string): string {
  return `https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(name)}&coordinate=wgs84&callnative=1`;
}

/**
 * A trip endpoint: the geocoder or geofence name when there is one, otherwise the
 * coordinates. Nominatim is off by default in TeslaMate, so most rows have no
 * name at all — printing "unknown place" for every one of them is a wall of
 * nothing, while the position was stored all along.
 *
 * Three decimals (~110 m) instead of four: enough to recognise a place in a list,
 * two characters shorter in a column that already truncates.
 */
export function placeLabel(
  name: string | null | undefined,
  lat?: number | null,
  lng?: number | null,
  empty: string = "",
): string {
  if (name) return name;
  if (lat != null && lng != null) return `${num(lat, 3)}, ${num(lng, 3)}`;
  return empty;
}
