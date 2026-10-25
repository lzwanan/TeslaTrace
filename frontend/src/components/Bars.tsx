/** Month bars. Divs, not SVG: percentage heights are simpler and reflow for free. */

export type BarDatum = { label: string; value: number | null };

/**
 * Bars with the number printed above each one.
 *
 * A bar without a value asks the reader to estimate a height against no axis,
 * which is how the year panel ended up looking like an empty box. The tallest
 * bar stops short of the top so its own label still fits inside the card.
 */
const HEADROOM = 82;

export function Bars({
  data,
  highlightLast = true,
  format,
}: {
  data: BarDatum[];
  highlightLast?: boolean;
  format?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value ?? 0));

  return (
    <div className="bars-wrap">
      <div className="bars">
        {data.map((item, index) => {
          const current = highlightLast && index === data.length - 1;
          const height = item.value === null ? 0 : Math.max(3, (item.value / max) * HEADROOM);
          return (
            <div className="bar-col" key={item.label}>
              <span className="bar-val">
                {item.value === null ? "—" : (format?.(item.value) ?? "")}
              </span>
              <div
                className={`bar${current ? " current" : ""}`}
                style={{ height: `${height}%` }}
                title={format?.(item.value ?? 0) ?? undefined}
              />
            </div>
          );
        })}
      </div>
      <div className="bars-labels">
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}
