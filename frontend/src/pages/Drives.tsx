/** The full trip list, cursor paginated. One fetch per page, no polling. */

import { useCallback, useEffect, useState } from "react";

import { DriveList } from "../components/DriveList";
import { Card, Tile } from "../components/ui";
import { apiGet } from "../lib/api";
import { num } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { Drive, DrivesPage, Summary } from "../lib/types";

const PAGE_SIZE = 20;

export function Drives({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  const carId = summary.car.id;

  const [drives, setDrives] = useState<Drive[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (before?: string) => {
      const query = new URLSearchParams({ car_id: String(carId), limit: String(PAGE_SIZE) });
      if (before) query.set("before", before);
      try {
        const page = await apiGet<DrivesPage>(`/drives?${query.toString()}`);
        setDrives((current) => (before ? [...current, ...page.drives] : page.drives));
        setPhase("ready");
      } catch {
        setPhase("error");
      } finally {
        setLoadingMore(false);
      }
    },
    [carId],
  );

  // A different car means a different list.
  useEffect(() => {
    setDrives([]);
    setPhase("loading");
    void load();
  }, [load]);

  const last = drives[drives.length - 1];
  const canLoadMore = phase === "ready" && drives.length > 0 && drives.length % PAGE_SIZE === 0;

  return (
    <div className="cards">
      <Card span="full" cols={12}>
        <div className="tiles-3">
          <Tile label={t("card.today")} value={num(summary.driving.today_km, 1)} unit="km" />
          <Tile label={t("card.month")} value={num(summary.driving.month_km)} unit="km" />
          <Tile label={t("card.month")} value={num(summary.driving.month_drives)} unit={t("kpi.drives")} />
        </div>
      </Card>

      <Card span="full" cols={12}>
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
          </>
        ) : null}
      </Card>
    </div>
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
