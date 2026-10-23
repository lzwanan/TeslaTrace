/**
 * The card registry.
 *
 * A dashboard is a list, not a layout: each card declares how wide it wants to be on
 * a desktop grid and when it should exist at all. Adding a card means appending one
 * object here — no page edits, no breakpoint edits.
 */

import type { ComponentType } from "react";

import type { Span } from "../components/ui";
import type { Summary } from "../lib/types";
import { AlertCard, alertKeys } from "./AlertCard";
import { ChargingCard } from "./ChargingCard";
import { LiveCard } from "./LiveCard";
import { PositionCard } from "./PositionCard";
import { RecentDrivesCard } from "./RecentDrivesCard";
import { BatteryCard, MonthCard, TodayCard, VehicleCard } from "./StatsGrid";

export type CardProps = { summary: Summary };

export type CardDef = {
  id: string;
  /** Width class for phones and tablets. */
  span: Span;
  /** Width out of 12 columns on a desktop grid. */
  cols: number;
  visible?: (summary: Summary) => boolean;
  Component: ComponentType<CardProps>;
};

export const OVERVIEW_CARDS: CardDef[] = [
  {
    id: "attention",
    span: "full",
    cols: 12,
    visible: (summary) => alertKeys(summary).length > 0,
    Component: AlertCard,
  },
  { id: "live", span: "full", cols: 5, Component: LiveCard },
  {
    id: "position",
    span: "half",
    cols: 7,
    // The card itself only needs the live block; the registry keeps one prop shape.
    Component: ({ summary }) => <PositionCard live={summary.live} />,
  },
  { id: "today", span: "kpi", cols: 3, Component: TodayCard },
  { id: "month", span: "kpi", cols: 3, Component: MonthCard },
  { id: "battery", span: "kpi", cols: 3, Component: BatteryCard },
  { id: "vehicle", span: "kpi", cols: 3, Component: VehicleCard },
  { id: "charging", span: "half", cols: 4, Component: ChargingCard },
  { id: "recent", span: "full", cols: 8, Component: RecentDrivesCard },
];
