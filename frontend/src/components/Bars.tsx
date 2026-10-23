/** Month bars. Divs, not SVG: percentage heights are simpler and reflow for free. */

export type BarDatum = { label: string; value: number | null };

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
          const height = item.value === null ? 0 : Math.max(3, (item.value / max) * 100);
          const current = highlightLast && index === data.length - 1;
          return (
            <div className="bar-col" key={item.label} title={format?.(item.value ?? 0) ?? undefined}>
              <div
                className={`bar${current ? " current" : ""}`}
                style={{ height: `${height}%` }}
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
