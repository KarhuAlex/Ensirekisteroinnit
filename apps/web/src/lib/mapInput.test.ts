import { describe, expect, it } from 'vitest';
import { panDirection, wheelFactor, wheelZooms } from './mapInput';
import { ZOOM_STEP } from './mapView';

describe('wheel', () => {
  it('zooms the map only with Ctrl or Cmd held', () => {
    expect(wheelZooms({ ctrlKey: true, metaKey: false })).toBe(true);
    expect(wheelZooms({ ctrlKey: false, metaKey: true })).toBe(true);
    expect(wheelZooms({ ctrlKey: false, metaKey: false })).toBe(false);
  });

  it('zooms in when the wheel turns away and out when it turns towards you', () => {
    expect(wheelFactor({ deltaY: -100, deltaMode: 0 })).toBeGreaterThan(1);
    expect(wheelFactor({ deltaY: 100, deltaMode: 0 })).toBeLessThan(1);
  });

  it('makes a notch of a mouse wheel one zoom step', () => {
    expect(wheelFactor({ deltaY: -100, deltaMode: 0 })).toBeCloseTo(ZOOM_STEP);
    expect(wheelFactor({ deltaY: -6.25, deltaMode: 1 })).toBeCloseTo(ZOOM_STEP);
  });

  it('zooms a little for the small turns of a trackpad pinch', () => {
    const factor = wheelFactor({ deltaY: -2, deltaMode: 0 });
    expect(factor).toBeGreaterThan(1);
    expect(factor).toBeLessThan(1.05);
  });

  it('goes no further than one step for a single event', () => {
    expect(wheelFactor({ deltaY: -5000, deltaMode: 0 })).toBeCloseTo(ZOOM_STEP);
    expect(wheelFactor({ deltaY: 5000, deltaMode: 0 })).toBeCloseTo(1 / ZOOM_STEP);
    expect(wheelFactor({ deltaY: 0, deltaMode: 0 })).toBe(1);
  });
});

describe('panDirection', () => {
  it('maps the arrow keys to steps east and north', () => {
    expect(panDirection('ArrowLeft')).toEqual([-1, 0]);
    expect(panDirection('ArrowRight')).toEqual([1, 0]);
    expect(panDirection('ArrowUp')).toEqual([0, 1]);
    expect(panDirection('ArrowDown')).toEqual([0, -1]);
  });

  it('ignores other keys', () => {
    expect(panDirection('Enter')).toBeNull();
    expect(panDirection('toString')).toBeNull();
  });
});
