import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FLEET_VIEW,
  parseFleetView,
  toFleetParams,
  withArea,
  withLevel,
  withShare,
} from './fleetView';

describe('parseFleetView', () => {
  it('starts from the regions and the battery-electric share', () => {
    expect(parseFleetView(new URLSearchParams())).toEqual(DEFAULT_FLEET_VIEW);
  });

  it('reads the level, the share and the area', () => {
    const view = parseFleetView(new URLSearchParams('level=municipality&share=plug&area=091'));
    expect(view).toEqual({ level: 'municipality', share: 'plug', area: '091' });
  });

  it('falls back to the defaults for values it does not know', () => {
    const view = parseFleetView(new URLSearchParams('level=galaxy&share=most&area='));
    expect(view).toEqual(DEFAULT_FLEET_VIEW);
  });
});

describe('toFleetParams', () => {
  it('leaves the defaults out of the address', () => {
    expect(toFleetParams(DEFAULT_FLEET_VIEW).toString()).toBe('');
  });

  it('round-trips a view', () => {
    const view = { level: 'municipality', share: 'plug', area: '091' } as const;
    expect(parseFleetView(toFleetParams(view))).toEqual(view);
  });
});

describe('changing the view', () => {
  it('forgets the area when the level changes, but not when the share does', () => {
    const view = { level: 'region', share: 'bev', area: '01' } as const;
    expect(withLevel(view, 'municipality').area).toBeNull();
    expect(withShare(view, 'plug').area).toBe('01');
  });

  it('chooses an area, and clears it when the same one is chosen again', () => {
    const chosen = withArea(DEFAULT_FLEET_VIEW, '01');
    expect(chosen.area).toBe('01');
    expect(withArea(chosen, '01').area).toBeNull();
    expect(withArea(chosen, '02').area).toBe('02');
  });
});
