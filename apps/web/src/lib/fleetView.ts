import type { ElectricShare } from './fleet';
import { isFuelFilter, type FuelFilter } from './fleetMakes';
import type { AreaLevel } from './reviewState';

/** What the car fleet page shows, kept in the address so a view can be shared. */
export interface FleetView {
  level: AreaLevel;
  /** The electric share shown while no make is chosen. */
  share: ElectricShare;
  /** The chosen region or municipality, or `null`. */
  area: string | null;
  /** The chosen make, whose cars are shown instead of the electric share, or `null`. */
  make: string | null;
  /** The cars of the make that are counted; `all` while no make is chosen. */
  fuel: FuelFilter;
}

export const DEFAULT_FLEET_VIEW: FleetView = {
  level: 'region',
  share: 'bev',
  area: null,
  make: null,
  fuel: 'all',
};

export function parseFleetView(params: URLSearchParams): FleetView {
  const level = params.get('level');
  const share = params.get('share');
  const fuel = params.get('fuel');
  const make = params.get('make') || null;
  return {
    level: level === 'municipality' ? 'municipality' : DEFAULT_FLEET_VIEW.level,
    share: share === 'plug' ? 'plug' : DEFAULT_FLEET_VIEW.share,
    area: params.get('area') || null,
    make,
    fuel: make && isFuelFilter(fuel) ? fuel : DEFAULT_FLEET_VIEW.fuel,
  };
}

/** The address parameters of a view; whatever is the default is left out. */
export function toFleetParams(view: FleetView): URLSearchParams {
  const params = new URLSearchParams();
  if (view.level !== DEFAULT_FLEET_VIEW.level) params.set('level', view.level);
  if (view.share !== DEFAULT_FLEET_VIEW.share) params.set('share', view.share);
  if (view.area) params.set('area', view.area);
  if (view.make) params.set('make', view.make);
  if (view.make && view.fuel !== DEFAULT_FLEET_VIEW.fuel) params.set('fuel', view.fuel);
  return params;
}

/** Another level has other areas, so the choice does not carry over. */
export const withLevel = (view: FleetView, level: AreaLevel): FleetView => ({
  ...view,
  level,
  area: null,
});

export const withShare = (view: FleetView, share: ElectricShare): FleetView => ({
  ...view,
  share,
});

/** Choosing the area that is already chosen clears the choice. */
export const withArea = (view: FleetView, area: string): FleetView => ({
  ...view,
  area: view.area === area ? null : area,
});

/** Another make starts again from all of its cars; no make has no fuel to choose. */
export const withMake = (view: FleetView, make: string | null): FleetView => ({
  ...view,
  make,
  fuel: DEFAULT_FLEET_VIEW.fuel,
});

export const withFuel = (view: FleetView, fuel: FuelFilter): FleetView => ({ ...view, fuel });
