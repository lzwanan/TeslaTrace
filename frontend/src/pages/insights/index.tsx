/**
 * Insights: five topics, one screen each.
 *
 * These were five "sections" stacked into a single card grid, where the last
 * three shared one row. Three anchors at the same offset means a scroll spy can
 * only ever pick the last of them, which is why the bar jumped to "places" as
 * soon as the page moved. Tabs are not cosmetic here: a topic needs its own
 * screen to have a heading, an explanation and one number worth reading.
 */

import { useEffect, useState } from "react";

import { Card, Empty, SectionHead, Skeleton } from "../../components/ui";
import { apiGet } from "../../lib/api";
import { useI18n, type TKey } from "../../lib/i18n";
import type { Stats, Summary } from "../../lib/types";
import { Annual } from "./Annual";
import { Charging } from "./Charging";
import { Habits } from "./Habits";
import { Monthly } from "./Monthly";
import { Places } from "./Places";

const MONTHS = 6;

export const SECTION_IDS = ["month", "year", "charging", "habits", "places"] as const;
export type InsightsSection = (typeof SECTION_IDS)[number];

const SECTIONS: { id: InsightsSection; label: TKey; title: TKey; desc: TKey }[] = [
  { id: "month", label: "insight.month", title: "insight.month.title", desc: "insight.month.desc" },
  { id: "year", label: "insight.year", title: "insight.year.title", desc: "insight.year.desc" },
  {
    id: "charging",
    label: "insight.charging",
    title: "insight.charging.title",
    desc: "insight.charging.desc",
  },
  {
    id: "habits",
    label: "insight.habits",
    title: "insight.habits.title",
    desc: "insight.habits.desc",
  },
  {
    id: "places",
    label: "insight.places",
    title: "insight.places.title",
    desc: "insight.places.desc",
  },
];

export function Insights({
  summary,
  nonce = 0,
  section = "month",
  onSection,
}: {
  summary: Summary;
  nonce?: number;
  section?: InsightsSection;
  onSection: (id: InsightsSection) => void;
}) {
  const { t } = useI18n();
  const carId = summary.car.id;

  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setStats(null);
    setFailed(false);
    apiGet<Stats>(`/stats?car_id=${carId}&months=${MONTHS}`)
      .then((data) => {
        if (alive) setStats(data);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [carId, nonce]);

  const meta = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];

  return (
    <>
      <nav className="seg" aria-label={t("insight.nav")}>
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            className="chip"
            type="button"
            aria-pressed={item.id === meta.id}
            onClick={() => onSection(item.id)}
          >
            {t(item.label)}
          </button>
        ))}
      </nav>

      <section>
        <SectionHead title={t(meta.title)} desc={t(meta.desc)} />

        {failed ? (
          <div className="cards">
            <Card span="full" cols={12}>
              <Empty title={t("ui.error")} />
            </Card>
          </div>
        ) : stats === null ? (
          <div className="cards">
            {[0, 1, 2].map((index) => (
              <Card key={index} span={index === 0 ? "full" : "half"} cols={index === 0 ? 8 : 4}>
                <Skeleton height={index === 0 ? 132 : 96} width="100%" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="cards">
            {meta.id === "month" ? (
              <Monthly stats={stats} summary={summary} months={MONTHS} />
            ) : meta.id === "year" ? (
              <Annual yearly={stats.yearly} />
            ) : meta.id === "charging" ? (
              <Charging profile={stats.charging} />
            ) : meta.id === "habits" ? (
              <Habits habits={stats.habits} />
            ) : (
              <Places places={stats.places} />
            )}
          </div>
        )}
      </section>
    </>
  );
}
