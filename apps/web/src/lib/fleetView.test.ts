import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FLEET_VIEW,
  parseFleetView,
  toFleetParams,
  withArea,
  withFuel,
  withLevel,
  withMake,
  withShare,
  type FleetView,
} from './fleetView';

describe('parseFleetView', () => {
  it('starts from the regions and the battery-electric share', () => {
    expect(parseFleetView(new URLSearchParams())).toEqual(DEFAULT_FLEET_VIEW);
  });

  it('reads the level, the share and the area', () => {
    const view = parseFleetView(new URLSearchParams('level=municipality&share=plug&area=091'));
    expect(view).toEqual({
      ...DEFAULT_FLEET_VIEW,
      level: 'municipality',
      share: 'plug',
      area: '091',
    });
  });

  it('reads the make and the fuel', () => {
    const view = parseFleetView(new URLSearchParams('make=make-a&fuel=bev'));
    expect(view).toMatchObject({ make: 'make-a', fuel: 'bev' });
  });

  it('has no fuel to choose without a make, and takes only a fuel it knows', () => {
    expect(parseFleetView(new URLSearchParams('fuel=bev')).fuel).toBe('all');
    expect(parseFleetView(new URLSearchParams('make=make-a&fuel=steam')).fuel).toBe('all');
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
    const view: FleetView = {
      level: 'municipality',
      share: 'plug',
      area: '091',
      make: 'make-a',
      fuel: 'phev',
    };
    expect(parseFleetView(toFleetParams(view))).toEqual(view);
  });

  it('leaves the fuel out until it is something else than all', () => {
    expect(toFleetParams({ ...DEFAULT_FLEET_VIEW, make: 'make-a' }).toString()).toBe('make=make-a');
    expect(toFleetParams({ ...DEFAULT_FLEET_VIEW, make: 'make-a', fuel: 'bev' }).toString()).toBe(
      'make=make-a&fuel=bev',
    );
  });
});

describe('changing the view', () => {
  it('forgets the area when the level changes, but not when the share does', () => {
    const view: FleetView = { ...DEFAULT_FLEET_VIEW, area: '01' };
    expect(withLevel(view, 'municipality').area).toBeNull();
    expect(withShare(view, 'plug').area).toBe('01');
  });

  it('chooses an area, and clears it when the same one is chosen again', () => {
    const chosen = withArea(DEFAULT_FLEET_VIEW, '01');
    expect(chosen.area).toBe('01');
    expect(withArea(chosen, '01').area).toBeNull();
    expect(withArea(chosen, '02').area).toBe('02');
  });

  it('keeps the area and the level when the make changes, and starts from all fuels', () => {
    const view = withFuel(withMake({ ...DEFAULT_FLEET_VIEW, area: '091' }, 'make-a'), 'bev');
    expect(view).toMatchObject({ make: 'make-a', fuel: 'bev', area: '091' });
    expect(withMake(view, 'make-b')).toMatchObject({ make: 'make-b', fuel: 'all', area: '091' });
    expect(withMake(view, null)).toMatchObject({ make: null, fuel: 'all' });
  });
});
