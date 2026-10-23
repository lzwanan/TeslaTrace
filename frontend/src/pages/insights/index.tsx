/** Insights: one fetch, five sections. Everything below reads small tables. */

import { useEffect, useState } from "react";

import { Card, Empty, Skeleton } from "../../components/ui";
import { apiGet } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import type { Stats, Summary } from "../../lib/types";
import { Annual } from "./Annual";
import { Charging } from "./Charging";
import { Habits } from "./Habits";
import { Monthly } from "./Monthly";
import { Places } from "./Places";

const MONTHS = 6;

export function Insights({ summary }: { summary: Summary }) {
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
  }, [carId]);

  if (failed) {
    return (
      <Card span="full" cols={12}>
        <Empty title={t("ui.error")} />
      </Card>
    );
  }

  if (!stats) {
    return (
      <div className="cards">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item} span={item % 2 === 0 ? "full" : "half"} cols={item % 2 === 0 ? 8 : 4}>
            <Skeleton height={130} width="100%" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="cards">
      <Monthly stats={stats} summary={summary} months={MONTHS} />
      <Annual yearly={stats.yearly} />
      <Charging profile={stats.charging} />
      <Habits habits={stats.habits} />
      <Places places={stats.places} />
    </div>
  );
}
