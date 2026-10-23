/** One SVG ring. No chart library: a donut is a circle with a dash offset. */

import type { CSSProperties, ReactNode } from "react";

const RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function Ring({
  value,
  max = 100,
  tone,
  children,
}: {
  value: number;
  max?: number;
  tone?: string;
  children: ReactNode;
}) {
  const ratio = Math.max(0, Math.min(1, value / max));

  return (
    <div className="soc" style={tone ? ({ "--tone": tone } as CSSProperties) : undefined}>
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle className="soc-track" cx="70" cy="70" r={RADIUS} />
        <circle
          className="soc-value"
          cx="70"
          cy="70"
          r={RADIUS}
          transform="rotate(-90 70 70)"
          strokeDasharray={`${(CIRCUMFERENCE * ratio).toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`}
        />
      </svg>
      <div className="soc-label">{children}</div>
    </div>
  );
}
