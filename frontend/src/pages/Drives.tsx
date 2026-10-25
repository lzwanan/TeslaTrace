/**
 * The full trip list, cursor paginated. One fetch per page, no polling.
 *
 * With a few thousand trips, "load more" alone is not browsing — the month filter
 * narrows to something a person can actually read, and it reuses the same paginated
 * query: the first page simply gets an upper bound instead of an open one.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { DriveList } from "../components/DriveList";
import { Card, Tile } from "../components/ui";
import { apiGet } from "../lib/api";
import { num } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { Drive, DrivesPage, Summary } from "../lib/types";

const PAGE_SIZE = 20;
const MONTH_OPTIONS = 6;

export function Drives({ summary, nonce = 0 }: { summary: Summary; nonce?: number }) {
  const { t, locale } = useI18n();
  const carId = summary.car.id;

  const [drives, setDrives] = useState<Drive[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [range, setRange] = useState("all");

  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: MONTH_OPTIONS }, (_, back) => {
      const start = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - back + 1, 1);
      return {
        key: `${start.getFullYear()}-${start.getMonth() + 1}`,
        label: start.toLocaleDateString(locale, { month: "short" }),
        since: start.toISOString(),
        before: end.toISOString(),
      };
    });
  }, [locale]);

  const bounds = months.find((month) => month.key === range);

  const load = useCallback(
    async (cursor?: string) => {
      const query = new URLSearchParams({ car_id: String(carId), limit: String(PAGE_SIZE) });
      const before = cursor ?? bounds?.before;
      if (before) query.set("before", before);
      if (bounds?.since) query.set("since", bounds.since);
      try {
        const page = await apiGet<DrivesPage>(`/drives?${query.toString()}`);
        setDrives((current) => (cursor ? [...current, ...page.drives] : page.drives));
        setPhase("ready");
      } catch {
        setPhase("error");
      } finally {
        setLoadingMore(false);
      }
    },
    [carId, bounds],
  );

  // A different car, a different month or a manual refresh is a different list.
  useEffect(() => {
    setDrives([]);
    setPhase("loading");
    void load();
  }, [load, nonce]);

  const last = drives[drives.length - 1];
  const canLoadMore = phase === "ready" && drives.length > 0 && drives.length % PAGE_SIZE === 0;

  return (
    <div className="cards">
      <Card span="full" cols={12}>
        <div className="tiles-3">
          <Tile label={t("card.today")} value={num(summary.driving.today_km, 1)} unit="km" />
          <Tile label={t("card.month")} value={num(summary.driving.month_km)} unit="km" />
          <Tile
            label={t("card.monthDrives")}
            value={num(summary.driving.month_drives)}
            unit={t("kpi.drives")}
          />
        </div>
      </Card>

      <Card span="full" cols={12}>
        <div className="chips" role="group" aria-label={t("drives.filter")}>
          <Chip pressed={range === "all"} onPick={() => setRange("all")} label={t("drives.all")} />
          {months.map((month) => (
            <Chip
              key={month.key}
              pressed={range === month.key}
              onPick={() => setRange(month.key)}
              label={month.label}
            />
          ))}
        </div>

        {phase === "loading" ? <DriveSkeleton /> : null}
        {phase === "error" ? (
          <div className="empty">
            <div>{t("ui.error")}</div>
            <button className="btn" type="button" onClick={() => void load()}>
              {t("ui.retry")}
            </button>
          </div>
        ) : null}
        {phase === "ready" ? (
          <>
            <DriveList drives={drives} emptyHint={t("drives.emptyHint")} />
            {canLoadMore ? (
              <button
                className="btn"
                type="button"
                style={{ marginTop: 12, width: "100%" }}
                disabled={loadingMore}
                onClick={() => {
                  setLoadingMore(true);
                  void load(last?.start_date);
                }}
              >
                {loadingMore ? t("ui.loading") : t("drives.more")}
              </button>
            ) : null}
            {drives.length > 0 ? (
              <div className="note" style={{ textAlign: "center" }}>
                {t("drives.shown", { n: drives.length })}
              </div>
            ) : null}
          </>
        ) : null}
      </Card>
    </div>
  );
}

function Chip({
  pressed,
  onPick,
  label,
}: {
  pressed: boolean;
  onPick: () => void;
  label: string;
}) {
  return (
    <button className="chip" type="button" aria-pressed={pressed} onClick={onPick}>
      {label}
    </button>
  );
}

function DriveSkeleton() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {[0, 1, 2, 3].map((row) => (
        <div className="skeleton" key={row} style={{ height: 34 }} />
      ))}
    </div>
  );
}
