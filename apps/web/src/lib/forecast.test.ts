import { describe, expect, it } from 'vitest';
import {
  backtest,
  BAND_MARGIN,
  BAND_MARGIN_PERCENT,
  CEILINGS,
  crossingWindow,
  DEFAULT_MODEL,
  forecast,
  forecastPath,
  MAX_HORIZON,
  MIN_HISTORY,
  MIN_SCORED_SHARE,
  pastCoverage,
  quantile,
  type ForecastModel,
} from './forecast';

const expit = (x: number) => 1 / (1 + Math.exp(-x));

/** A share in percent that follows a logistic curve exactly: a straight line on the logit scale. */
const logistic = (months: number, start: number, perMonth: number, ceiling = 1): number[] =>
  Array.from({ length: months }, (_, i) => expit(start + perMonth * i) * ceiling * 100);

/** The same, with a shift that jumps between two values, like the noise of real months. */
const noisy = (values: number[], amount: number): number[] =>
  values.map((v, i) => v * (1 + (i % 2 === 0 ? amount : -amount)));

const undamped: ForecastModel = { ...DEFAULT_MODEL, damping: 1 };

describe('forecastPath', () => {
  it('carries a logistic curve on exactly when nothing fades', () => {
    const series = logistic(60, -5, 0.1);
    const path = forecastPath(series.slice(0, 36), 12, undamped);
    const actual = series.slice(36, 48);
    path.forEach((value, i) => expect(value).toBeCloseTo(actual[i] as number, 6));
  });

  it('has the slope fade, so a damped path stays under an undamped one', () => {
    const series = logistic(36, -5, 0.1);
    const damped = forecastPath(series, 24, DEFAULT_MODEL);
    const plain = forecastPath(series, 24, undamped);
    expect(damped[23]).toBeLessThan(plain[23] as number);
    expect(damped[0]).toBeGreaterThan(series[series.length - 1] as number);
  });

  it('gives a path of as many months as asked, rising for a rising share', () => {
    const path = forecastPath(logistic(36, -5, 0.1), 18);
    expect(path).toHaveLength(18);
    expect(path.every((v, i) => i === 0 || v >= (path[i - 1] as number))).toBe(true);
  });

  it('stays between nothing and the whole, however steep the history', () => {
    const steep = logistic(30, -9, 0.5);
    const path = forecastPath(steep, 60, undamped);
    expect(Math.min(...path)).toBeGreaterThan(0);
    expect(Math.max(...path)).toBeLessThanOrEqual(100);
  });

  it('never goes over the ceiling', () => {
    for (const ceiling of CEILINGS) {
      const path = forecastPath(logistic(36, -4, 0.2, ceiling), 120, { ...undamped, ceiling });
      expect(Math.max(...path)).toBeLessThanOrEqual(ceiling * 100 + 1e-9);
    }
  });

  it('holds at the ceiling when the share is already there', () => {
    const path = forecastPath(Array(24).fill(80), 6, { ...DEFAULT_MODEL, ceiling: 0.7 });
    expect(Math.max(...path)).toBeLessThanOrEqual(70);
    expect(Math.min(...path)).toBeGreaterThan(69.9);
  });

  it('falls for a falling share', () => {
    const path = forecastPath(logistic(36, 1, -0.1), 12);
    expect(path[11]).toBeLessThan(path[0] as number);
  });

  it('says nothing with too little history', () => {
    expect(forecastPath(logistic(MIN_HISTORY - 1, -3, 0.1), 12)).toEqual([]);
    expect(forecastPath([], 12)).toEqual([]);
  });

  it('is a lower ceiling for the same history, a lower path', () => {
    const series = logistic(36, -5, 0.1);
    const low = forecastPath(series, 36, { ...DEFAULT_MODEL, ceiling: 0.7 });
    const high = forecastPath(series, 36, { ...DEFAULT_MODEL, ceiling: 1 });
    expect(low[35]).toBeLessThan(high[35] as number);
  });
});

describe('backtest', () => {
  it('finds no errors where the method is exactly right', () => {
    const { errors } = backtest(logistic(60, -5, 0.1), 12, undamped);
    for (const past of errors) {
      expect(past.length).toBeGreaterThan(0);
      past.forEach((e) => expect(Math.abs(e)).toBeLessThan(1e-6));
    }
  });

  it('has fewer past forecasts the farther ahead it looks', () => {
    const { errors } = backtest(logistic(60, -3, 0.1), 12);
    expect(errors).toHaveLength(12);
    expect(errors[0]?.length).toBeGreaterThan(errors[11]?.length ?? 0);
  });

  it('does not score the months from which the share was still tiny', () => {
    const small = Array(40).fill(MIN_SCORED_SHARE / 2);
    expect(backtest(small, 6).errors.every((past) => past.length === 0)).toBe(true);
  });

  it('errs high where growth was slowing, and low where it was speeding up', () => {
    const slowing = [...logistic(24, -3, 0.2), ...logistic(24, 1.8, 0.02)];
    const speeding = [...logistic(24, -6, 0.02), ...logistic(24, -5.5, 0.25)];
    const sign = (series: number[]) => {
      const past = backtest(series, 6, undamped).errors[5] as number[];
      return past.reduce((a, b) => a + b, 0);
    };
    expect(sign(slowing)).toBeLessThan(0);
    expect(sign(speeding)).toBeGreaterThan(0);
  });
});

describe('quantile', () => {
  it('takes the value a fraction of the way through, between neighbours', () => {
    expect(quantile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4, 5], 1)).toBe(5);
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([0, 10], 0.25)).toBe(2.5);
  });

  it('does not depend on the order of the values, and has nothing for none', () => {
    expect(quantile([5, 1, 3], 0.5)).toBe(3);
    expect(quantile([], 0.5)).toBeNull();
  });
});

describe('forecast', () => {
  it('has a band around the path, which the path never leaves', () => {
    const result = forecast(noisy(logistic(70, -5, 0.08), 0.05), MAX_HORIZON);
    expect(result.path).toHaveLength(MAX_HORIZON);
    result.path.forEach((value, i) => {
      expect(result.low[i]).toBeLessThanOrEqual(value + 1e-9);
      expect(result.high[i]).toBeGreaterThanOrEqual(value - 1e-9);
    });
  });

  it('is no band at all where the method was always right', () => {
    const result = forecast(logistic(70, -5, 0.08), 12, undamped);
    result.path.forEach((value, i) => {
      expect(result.high[i]).toBeCloseTo(value, 4);
      expect(result.low[i]).toBeCloseTo(value, 4);
    });
  });

  it('has a band that grows with the distance on the logit scale, never narrowing', () => {
    const logit = (percent: number) => Math.log(percent / (100 - percent));
    const result = forecast(noisy(logistic(72, -5, 0.08), 0.06), 24);
    const widths = result.high.map((high, i) => logit(high) - logit(result.low[i] as number));
    widths.forEach((width, i) => {
      if (i > 0) expect(width).toBeGreaterThanOrEqual((widths[i - 1] as number) - 1e-9);
    });
    expect(widths[23]).toBeGreaterThan(widths[0] as number);
  });

  it('has a wider band after a setback than for a smooth rise', () => {
    const smooth = logistic(72, -5, 0.08);
    const setback = smooth.map((v, i) => (i >= 40 && i < 52 ? v * 0.7 : v));
    const width = (series: number[]) => {
      const r = forecast(series, 12);
      return (r.high[11] as number) - (r.low[11] as number);
    };
    expect(width(setback)).toBeGreaterThan(width(smooth));
  });

  it('keeps the band inside the ceiling', () => {
    const model = { ...DEFAULT_MODEL, ceiling: 0.7 };
    const result = forecast(noisy(logistic(72, -4, 0.1, 0.7), 0.05), 36, model);
    expect(Math.max(...result.high)).toBeLessThanOrEqual(70 + 1e-9);
    expect(Math.min(...result.low)).toBeGreaterThan(0);
  });

  it('tells how many past forecasts the band is made of', () => {
    const result = forecast(logistic(60, -3, 0.1), 24);
    expect(result.basis.nearest).toBeGreaterThan(result.basis.farthest);
    expect(result.basis.farthest).toBeGreaterThan(0);
  });

  it('has nothing for too little history', () => {
    expect(forecast(logistic(5, -3, 0.1), 12)).toEqual({
      path: [],
      low: [],
      high: [],
      basis: { nearest: 0, farthest: 0 },
    });
  });
});

describe('crossingWindow', () => {
  const edges = {
    low: [40, 48, 56, 64, 72],
    high: [50, 60, 70, 80, 90],
  };

  it('gives the months in which the level is first reached by the upper and the lower edge', () => {
    expect(crossingWindow(edges, 60)).toEqual({ earliest: 2, latest: 4 });
    expect(crossingWindow(edges, 50)).toEqual({ earliest: 1, latest: 3 });
  });

  it('has no latest month where even the lower edge does not get there', () => {
    expect(crossingWindow(edges, 85)).toEqual({ earliest: 5, latest: null });
  });

  it('has neither where the level is out of reach', () => {
    expect(crossingWindow(edges, 95)).toEqual({ earliest: null, latest: null });
  });
});

describe('pastCoverage', () => {
  it('holds every time where the method is exactly right', () => {
    const { all, recent } = pastCoverage(logistic(80, -5, 0.08), 6, undamped);
    expect(all.tried).toBeGreaterThan(10);
    expect(all.held).toBe(all.tried);
    expect(recent.held).toBe(recent.tried);
  });

  it('counts the latest moments apart, and never more than were tried', () => {
    const { all, recent } = pastCoverage(noisy(logistic(80, -5, 0.08), 0.08), 6);
    expect(recent.tried).toBeLessThanOrEqual(24);
    expect(recent.tried).toBeLessThanOrEqual(all.tried);
    expect(all.held).toBeLessThanOrEqual(all.tried);
  });

  it('has nothing to count for a share that stays tiny or a history that is short', () => {
    expect(pastCoverage(Array(60).fill(MIN_SCORED_SHARE / 2), 6).all.tried).toBe(0);
    expect(pastCoverage(logistic(10, -5, 0.1), 6).all.tried).toBe(0);
  });

  it('holds less often after a setback that the method could not have known of', () => {
    const smooth = logistic(84, -5, 0.08);
    const setback = smooth.map((v, i) => (i >= 60 && i < 72 ? v * 0.6 : v));
    const rate = (series: number[]) => {
      const { all } = pastCoverage(series, 6);
      return all.held / all.tried;
    };
    expect(rate(setback)).toBeLessThan(rate(smooth));
  });
});

describe('forecast, without enough past errors', () => {
  it('gives no scenario rather than a path with no band, for a short history', () => {
    expect(forecast(logistic(20, -3, 0.1), 12).path).toEqual([]);
    expect(forecast(logistic(MIN_HISTORY, -3, 0.1), 12).path).toEqual([]);
  });

  it('gives none either where the share was always tiny, so nothing could be measured', () => {
    expect(forecast(Array(80).fill(MIN_SCORED_SHARE / 2), 12).path).toEqual([]);
  });

  it('gives a scenario once the nearest month has enough past errors', () => {
    expect(forecast(logistic(60, -3, 0.1), 12).path).toHaveLength(12);
  });
});

describe('BAND_MARGIN_PERCENT', () => {
  it('is the margin as the percent the band is made wider by', () => {
    expect(BAND_MARGIN_PERCENT).toBe(Math.round((BAND_MARGIN - 1) * 100));
    expect(BAND_MARGIN_PERCENT).toBeGreaterThan(0);
  });
});
