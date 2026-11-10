import { describe, expect, it } from 'vitest';
import { donutSegments } from './donut';

const mix = { bev: 60, phev: 10, petrol: 27, diesel: 3, other: 0 };

describe('donutSegments', () => {
  it('lays the groups out one after another in stack order', () => {
    const segments = donutSegments(mix);
    expect(segments.map((s) => [s.group, s.start])).toEqual([
      ['bev', 0],
      ['phev', 60],
      ['petrol', 70],
      ['diesel', 97],
    ]);
    expect(segments.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  it('leaves a small gap after large segments only', () => {
    const [bev, , , diesel] = donutSegments(mix);
    expect(bev?.dash).toBeCloseTo(59.4);
    expect(diesel?.dash).toBe(3 - 0.6);
    expect(donutSegments({ ...mix, bev: 1.5, petrol: 85.5, diesel: 0 })[0]?.dash).toBe(1.5);
  });

  it('draws nothing for an empty month', () => {
    expect(donutSegments({ bev: 0, phev: 0, petrol: 0, diesel: 0, other: 0 })).toEqual([]);
  });
});
