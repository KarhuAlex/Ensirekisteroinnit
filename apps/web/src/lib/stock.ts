import { monthEndDate, quarterEndPeriod, type CarStock } from '@regs/core';
import { percent } from './stats';

/** Electric shares of the car stock, one value per quarter, in percent. */
export interface StockShares {
  /** The month each quarter ends in; the stock is counted on its last day. */
  periods: string[];
  bev: (number | null)[];
  /** Battery-electric and plug-in hybrid together. */
  plugIn: (number | null)[];
}

export function stockShares(stock: CarStock): StockShares {
  const share = (count: (i: number) => number) =>
    stock.total.map((total, i) => percent(count(i), total));
  return {
    periods: stock.quarters.map(quarterEndPeriod),
    bev: share((i) => stock.series.bev[i] ?? 0),
    plugIn: share((i) => (stock.series.bev[i] ?? 0) + (stock.series.phev[i] ?? 0)),
  };
}

export interface LatestStock {
  /** The day the stock was counted, `YYYY-MM-DD`. */
  date: string;
  bevShare: number;
}

/** The newest quarter's battery-electric share and the day it describes; `null` without a share. */
export function latestStock(stock: CarStock): LatestStock | null {
  const last = stock.quarters.length - 1;
  const quarter = stock.quarters[last];
  if (quarter === undefined) return null;
  const bevShare = percent(stock.series.bev[last] ?? 0, stock.total[last] ?? 0);
  if (bevShare === null) return null;
  return { date: monthEndDate(quarterEndPeriod(quarter)), bevShare };
}
