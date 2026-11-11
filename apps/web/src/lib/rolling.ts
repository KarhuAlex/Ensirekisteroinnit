/**
 * The rolling chart shows either months of registrations or quarters of the car stock. For
 * quarters the points are labelled by day, the span is always the whole series, and the share axis
 * fits the low shares instead of running to 100.
 */
import { monthEndDate } from '@regs/core';
import { shareAxisMax } from './charts';
import type { Formatters } from './format';
import { rangeStart, type RangeId } from './stats';

/** The first point shown. Quarters have no range choice, so the whole series is shown. */
export const firstPoint = (quarterly: boolean, count: number, range: RangeId): number =>
  quarterly ? 0 : rangeStart(count, range);

/** The name of a point: the day a quarter ends on, or the month. */
export const pointLabel = (fmt: Formatters, period: string, quarterly: boolean): string =>
  quarterly ? fmt.date(monthEndDate(period)) : fmt.month(period);

/** The top of the share axis; `undefined` leaves the whole scale. */
export const axisTop = (quarterly: boolean, shares: readonly (number | null)[]) =>
  quarterly ? shareAxisMax(shares) : undefined;
