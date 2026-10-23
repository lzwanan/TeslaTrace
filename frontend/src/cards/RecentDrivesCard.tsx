/** Three most recent trips, with a way into the full list. */

import { Route } from "lucide-react";

import { DriveList } from "../components/DriveList";
import { Card, Cap } from "../components/ui";
import { useI18n } from "../lib/i18n";
import type { Summary } from "../lib/types";

export function RecentDrivesCard({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  return (
    <Card span="full" cols={8}>
      <Cap
        icon={Route}
        title={t("card.recent")}
        aside={
          <a href="#/drives" style={{ color: "inherit", textDecoration: "none" }}>
            {t("recent.all")} ›
          </a>
        }
      />
      <DriveList drives={summary.recent_drives} />
    </Card>
  );
}
