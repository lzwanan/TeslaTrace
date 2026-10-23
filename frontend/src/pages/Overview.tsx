/** The overview is a fold over the registry. */

import type { Summary } from "../lib/types";
import { OVERVIEW_CARDS } from "../cards";

export function Overview({ summary }: { summary: Summary }) {
  const cards = OVERVIEW_CARDS.filter((card) => !card.visible || card.visible(summary));

  return (
    <div className="cards">
      {cards.map(({ id, Component }) => (
        <Component key={id} summary={summary} />
      ))}
    </div>
  );
}
