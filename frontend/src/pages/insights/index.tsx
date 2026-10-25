/**
 * Insights: one fetch, five sections.
 *
 * Five sections on a phone is a very long page, and "scroll until you find it" is
 * not navigation. A sticky chip bar jumps to a section and follows the scroll, so
 * the page stays one screen of scrolling per topic instead of five.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Card, Empty, Skeleton } from "../../components/ui";
import { apiGet } from "../../lib/api";
import { useI18n, type TKey } from "../../lib/i18n";
import type { Stats, Summary } from "../../lib/types";
import { Annual } from "./Annual";
import { Charging } from "./Charging";
import { Habits } from "./Habits";
import { Monthly } from "./Monthly";
import { Places } from "./Places";

const MONTHS = 6;

/** Distance from the top of the scroll area, in px, where a section counts as "here". */
const OFFSET = 56;

const SECTIONS: { anchor: string; label: TKey }[] = [
  { anchor: "sec-month", label: "insight.month" },
  { anchor: "sec-year", label: "insight.year" },
  { anchor: "sec-charging", label: "insight.charging" },
  { anchor: "sec-habits", label: "insight.habits" },
  { anchor: "sec-places", label: "insight.places" },
];

export function Insights({ summary, nonce = 0 }: { summary: Summary; nonce?: number }) {
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

  const { sections, active, navRef, jump } = useSectionNav(stats);

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
    <>
      {/* A section that has no data renders nothing, so it also loses its chip. */}
      <nav className="sectionnav" ref={navRef} aria-label={t("insight.nav")}>
        {sections.map((section) => (
          <button
            key={section.anchor}
            className="chip"
            type="button"
            aria-pressed={active === section.anchor}
            onClick={() => jump(section.anchor)}
          >
            {t(section.label)}
          </button>
        ))}
      </nav>

      <div className="cards">
        <Monthly stats={stats} summary={summary} months={MONTHS} />
        <Annual yearly={stats.yearly} />
        <Charging profile={stats.charging} />
        <Habits habits={stats.habits} />
        <Places places={stats.places} />
      </div>
    </>
  );
}

/**
 * Highlights the section under the reader and jumps to one on tap.
 *
 * The scroll container lives outside this component (`.views` in the shell), so it
 * is found once through the nav's ancestors rather than threaded down as a prop.
 */
function useSectionNav(stats: Stats | null) {
  const navRef = useRef<HTMLElement>(null);
  const [anchors, setAnchors] = useState<string[]>([]);
  const [active, setActive] = useState(SECTIONS[0].anchor);

  const container = () => navRef.current?.closest<HTMLElement>(".views") ?? null;

  // Sections are free to render nothing; the bar only offers what actually exists.
  useLayoutEffect(() => {
    setAnchors(
      SECTIONS.map((section) => section.anchor).filter((anchor) => document.getElementById(anchor)),
    );
  }, [stats]);

  useEffect(() => {
    const box = container();
    if (!box || anchors.length === 0) return;

    let frame = 0;
    const read = () => {
      frame = 0;
      const line = box.getBoundingClientRect().top + OFFSET;
      let current = anchors[0];
      for (const anchor of anchors) {
        const node = document.getElementById(anchor);
        if (node && node.getBoundingClientRect().top <= line) current = anchor;
      }
      // The last section is often too short to ever reach the line on its own.
      const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 8;
      setActive(atBottom ? anchors[anchors.length - 1] : current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    read();
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      box.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [anchors]);

  const jump = useCallback((anchor: string) => {
    const box = container();
    const node = document.getElementById(anchor);
    if (!box || !node) return;
    const delta = node.getBoundingClientRect().top - box.getBoundingClientRect().top;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({
      top: Math.max(0, box.scrollTop + delta - OFFSET),
      behavior: reduce ? "auto" : "smooth",
    });
    setActive(anchor);
  }, []);

  const sections = SECTIONS.filter((section) => anchors.includes(section.anchor));
  return { sections, active, navRef, jump };
}
