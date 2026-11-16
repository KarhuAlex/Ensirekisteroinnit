/**
 * A scenario for a share that grows towards a ceiling, such as the electric share of first
 * registrations. Shares go in and come out in percent.
 *
 * The share is put on the logit scale, where growth that slows near the ceiling is a straight line.
 * A line is fitted to the last months, and its slope carries on but fades month by month (damping),
 * since growth that was fast does not stay fast. The band around the path is not a statistical
 * guess: it is how far this same method was off in the past, at each distance ahead, made wider
 * because the plain past errors came out too small when the band was tried on the past itself.
 */

export interface ForecastModel {
  /** How many of the latest months the slope is fitted to. */
  window: number;
  /** The share of the slope that is kept from one month to the next, 1 being none lost. */
  damping: number;
  /** The most the share can reach, as a fraction: 1 is all, 0.7 is seven in ten. */
  ceiling: number;
}

export const DEFAULT_MODEL: ForecastModel = { window: 24, damping: 0.97, ceiling: 1 };

/** The ceilings offered to the user. */
export const CEILINGS = [0.7, 0.85, 1] as const;

/** Fewer months than this tell nothing about a slope. */
export const MIN_HISTORY = 12;
/** The distance ahead, in months, that a scenario goes at most. */
export const MAX_HORIZON = 36;
/** A share below this says little on the logit scale, so it is not used to measure the method. */
export const MIN_SCORED_SHARE = 1;
/** The band is as wide as the error that this share of the method's past errors stayed within. */
export const BAND_QUANTILE = 0.9;
/**
 * The band is made this much wider than that. On the Finnish series, with only the errors known at
 * each moment, the result held the later share 8 times in 10 six and twelve months ahead, where the
 * plain quantile held it 4 times in 10.
 */
export const BAND_MARGIN = 1.35;
/** The margin as the percent that the band is made wider by, for the texts that explain it. */
export const BAND_MARGIN_PERCENT = Math.round((BAND_MARGIN - 1) * 100);
/** A distance with fewer past forecasts than this has no band of its own and takes a nearer one. */
export const MIN_BAND_SAMPLES = 12;

const EDGE = 1e-4;

const logit = (p: number): number => Math.log(p / (1 - p));
const expit = (x: number): number => 1 / (1 + Math.exp(-x));
const clampUnit = (p: number): number => Math.min(1 - EDGE, Math.max(EDGE, p));

/** A share in percent on the scale where growth towards the ceiling is a straight line. */
const toScale = (percent: number, ceiling: number): number =>
  logit(clampUnit(percent / 100 / ceiling));
const fromScale = (x: number, ceiling: number): number => expit(x) * ceiling * 100;

/** The slope of the least-squares line through the points, per step. */
function slope(values: readonly number[]): number {
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  values.forEach((y, i) => {
    sxx += (i - meanX) ** 2;
    sxy += (i - meanX) * (y - meanY);
  });
  return sxy / sxx;
}

/** The central path on the logit scale for each month ahead; empty if there is too little history. */
function scalePath(history: readonly number[], horizon: number, model: ForecastModel): number[] {
  if (history.length < MIN_HISTORY) return [];
  const recent = history.slice(-model.window).map((p) => toScale(p, model.ceiling));
  const rate = slope(recent);
  const last = recent[recent.length - 1] as number;
  const path: number[] = [];
  let faded = 0;
  let kept = 1;
  for (let h = 1; h <= horizon; h++) {
    kept *= model.damping;
    faded += kept;
    path.push(last + rate * faded);
  }
  return path;
}

/** The central path, in percent, for each month ahead of the history. */
export function forecastPath(
  history: readonly number[],
  horizon: number,
  model: ForecastModel = DEFAULT_MODEL,
): number[] {
  return scalePath(history, horizon, model).map((x) => fromScale(x, model.ceiling));
}

/** The method's past errors on the logit scale, for each distance ahead (index 0 is one month). */
export interface Backtest {
  errors: number[][];
}

/**
 * Makes the forecast from every month of the history in turn and records how far it was from what
 * came to be. Months from which the share was still below `MIN_SCORED_SHARE` are not scored.
 */
export function backtest(
  history: readonly number[],
  horizon: number,
  model: ForecastModel = DEFAULT_MODEL,
): Backtest {
  const errors: number[][] = Array.from({ length: horizon }, () => []);
  for (let origin = MIN_HISTORY - 1; origin < history.length - 1; origin++) {
    if ((history[origin] as number) < MIN_SCORED_SHARE) continue;
    const path = scalePath(history.slice(0, origin + 1), horizon, model);
    for (let h = 1; h <= horizon && origin + h < history.length; h++) {
      const actual = toScale(history[origin + h] as number, model.ceiling);
      (errors[h - 1] as number[]).push(actual - (path[h - 1] as number));
    }
  }
  return { errors };
}

/** The value a fraction of the way through the sorted values, between neighbours if need be. */
export function quantile(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const below = Math.floor(position);
  const above = Math.ceil(position);
  const weight = position - below;
  return (sorted[below] as number) * (1 - weight) + (sorted[above] as number) * weight;
}

export interface Forecast {
  /** Percent, for each month ahead; the arrays are empty where there is no scenario to give. */
  path: number[];
  /** The edges of the band, in percent. The path is always inside it. */
  low: number[];
  high: number[];
  /** How many past forecasts the band is made of, at the nearest and the farthest month. */
  basis: { nearest: number; farthest: number };
}

const noForecast = (): Forecast => ({
  path: [],
  low: [],
  high: [],
  basis: { nearest: 0, farthest: 0 },
});

/**
 * The half-width of the band on the logit scale for each month ahead. Uncertainty does not shrink
 * with distance, so no band is narrower than a nearer one; a distance with too few past forecasts
 * takes the width of the nearer ones.
 */
function bandWidths({ errors }: Backtest): number[] {
  let widest = 0;
  return errors.map((past) => {
    if (past.length >= MIN_BAND_SAMPLES) {
      const size = quantile(past.map(Math.abs), BAND_QUANTILE) ?? 0;
      widest = Math.max(widest, size * BAND_MARGIN);
    }
    return widest;
  });
}

/**
 * The scenario: a path, and a band from how far the method has been off before. Without enough
 * past errors even for the nearest month there is no band to give, and a path with no band would
 * claim a certainty it does not have, so the result is empty.
 */
export function forecast(
  history: readonly number[],
  horizon: number = MAX_HORIZON,
  model: ForecastModel = DEFAULT_MODEL,
): Forecast {
  const centre = scalePath(history, horizon, model);
  const past = backtest(history, horizon, model);
  if (centre.length === 0 || (past.errors[0]?.length ?? 0) < MIN_BAND_SAMPLES) return noForecast();
  const widths = bandWidths(past);
  return {
    path: centre.map((x) => fromScale(x, model.ceiling)),
    low: centre.map((x, i) => fromScale(x - (widths[i] as number), model.ceiling)),
    high: centre.map((x, i) => fromScale(x + (widths[i] as number), model.ceiling)),
    basis: {
      nearest: past.errors[0]?.length ?? 0,
      farthest: past.errors[past.errors.length - 1]?.length ?? 0,
    },
  };
}

/** How often the band held what came to be, when made from what was known at each moment. */
export interface PastCoverage {
  /** All the moments that could be tried, and the latest ones among them. */
  all: { held: number; tried: number };
  recent: { held: number; tried: number };
}

/** How many of the latest moments count as recent. */
const RECENT_ORIGINS = 24;
/** Shares on the logit scale are compared at this precision. */
const SAME_SCALE = 1e-6;

/**
 * Tries the method on the past: from each month it makes the band with only the errors known by
 * then and checks whether the share `distance` months later fell inside it. Months from which the
 * share was tiny, or with too few past errors for a band, are left out.
 */
export function pastCoverage(
  history: readonly number[],
  distance: number,
  model: ForecastModel = DEFAULT_MODEL,
): PastCoverage {
  const results: boolean[] = [];
  for (let origin = MIN_HISTORY - 1; origin + distance < history.length; origin++) {
    if ((history[origin] as number) < MIN_SCORED_SHARE) continue;
    const known = history.slice(0, origin + 1);
    const past = backtest(known, distance, model);
    if ((past.errors[distance - 1]?.length ?? 0) < MIN_BAND_SAMPLES) continue;
    const centre = scalePath(known, distance, model)[distance - 1] as number;
    const width = bandWidths(past)[distance - 1] as number;
    const actual = toScale(history[origin + distance] as number, model.ceiling);
    results.push(Math.abs(actual - centre) <= width + SAME_SCALE);
  }
  const count = (flags: boolean[]) => ({
    held: flags.filter(Boolean).length,
    tried: flags.length,
  });
  return { all: count(results), recent: count(results.slice(-RECENT_ORIGINS)) };
}

/**
 * The months ahead in which a share first reaches a level: the earliest by the upper edge of the
 * band and the latest by the lower edge. `null` where that does not happen within the horizon.
 */
export function crossingWindow(
  { low, high }: Pick<Forecast, 'low' | 'high'>,
  level: number,
): { earliest: number | null; latest: number | null } {
  const first = (edge: readonly number[]): number | null => {
    const index = edge.findIndex((value) => value >= level);
    return index < 0 ? null : index + 1;
  };
  return { earliest: first(high), latest: first(low) };
}
