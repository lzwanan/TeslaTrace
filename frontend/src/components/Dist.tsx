/**
 * A small horizontal bar list for any {key, value} distribution.
 *
 * Percentages are computed against the total, bars against the largest bucket:
 * the reader wants "how much of the whole", the eye wants a comparable shape.
 */

import type { Distribution } from "../lib/types";

export function Dist({
  items,
  labelOf,
}: {
  items: Distribution[];
  labelOf: (key: string) => string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <ul className="dist">
      {items.map((item) => (
        <li key={item.key}>
          <span className="label">{labelOf(item.key)}</span>
          <span className="dbar">
            <i style={{ width: `${Math.round((item.value / max) * 100)}%` }} />
          </span>
          <em>{Math.round((item.value / total) * 100)}%</em>
        </li>
      ))}
    </ul>
  );
}
