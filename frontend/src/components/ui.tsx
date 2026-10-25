/** Five primitives. Everything else is a composition of these. */

import type { CSSProperties, ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

export type Span = "full" | "half" | "kpi";
export type Tone = "green" | "blue" | "amber" | "red" | "muted";

const SPAN_CLASS: Record<Span, string> = {
  full: "c-full",
  half: "c-half",
  kpi: "c-kpi",
};

export function Card({
  span = "full",
  cols,
  className = "",
  tone,
  id,
  children,
}: {
  span?: Span;
  /** Desktop columns out of 12. Phones and tablets use the span class alone. */
  cols?: number;
  className?: string;
  tone?: Tone;
  /** Anchor for the in-page section nav; set on the first card of a section. */
  id?: string;
  children: ReactNode;
}) {
  const style: CSSProperties = {};
  if (cols) style["--sp" as keyof CSSProperties] = String(cols) as never;
  if (tone) style["--tone" as keyof CSSProperties] = `var(--${tone})` as never;

  return (
    <article id={id} className={`card ${SPAN_CLASS[span]} ${className}`} style={style}>
      {children}
    </article>
  );
}

export function Cap({
  icon: Icon,
  title,
  aside,
}: {
  icon?: LucideIcon;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="cap">
      {Icon ? <Icon size={15} strokeWidth={1.8} /> : null}
      <span>{title}</span>
      {aside ? <span className="aside">{aside}</span> : null}
    </div>
  );
}

export function Kpi({
  icon: Icon,
  label,
  value,
  unit,
  note,
  noteTone,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  note?: ReactNode;
  noteTone?: "good" | "warn";
}) {
  return (
    <>
      <div className="kpi-label">
        {Icon ? <Icon size={15} strokeWidth={1.8} /> : null}
        <span>{label}</span>
      </div>
      <div className="kpi-value">
        {value}
        {unit ? <span>{unit}</span> : null}
      </div>
      {note ? <div className={`kpi-note ${noteTone ?? ""}`}>{note}</div> : null}
    </>
  );
}

export function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="tile">
      <span>{label}</span>
      <b>
        {value}
        {unit ? <i>{unit}</i> : null}
      </b>
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <Inbox size={26} strokeWidth={1.5} />
      <div>{title}</div>
      {hint ? <div style={{ fontSize: 11, opacity: 0.75 }}>{hint}</div> : null}
    </div>
  );
}

/** Placeholder shaped like the card that will replace it, so nothing jumps. */
export function Skeleton({ height = 16, width = "60%" }: { height?: number; width?: string }) {
  return <div className="skeleton" style={{ height, width }} />;
}
