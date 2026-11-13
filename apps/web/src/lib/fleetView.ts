import type { ElectricShare } from './fleet';
import type { AreaLevel } from './reviewState';

/** What the car fleet page shows, kept in the address so a view can be shared. */
export interface FleetView {
  level: AreaLevel;
  share: ElectricShare;
  /** The chosen region or municipality, or `null`. */
  area: string | null;
}

export const DEFAULT_FLEET_VIEW: FleetView = { level: 'region', share: 'bev', area: null };

export function parseFleetView(params: URLSearchParams): FleetView {
  const level = params.get('level');
  const share = params.get('share');
  return {
    level: level === 'municipality' ? 'municipality' : DEFAULT_FLEET_VIEW.level,
    share: share === 'plug' ? 'plug' : DEFAULT_FLEET_VIEW.share,
    area: params.get('area') || null,
  };
}

/** The address parameters of a view; whatever is the default is left out. */
export function toFleetParams(view: FleetView): URLSearchParams {
  const params = new URLSearchParams();
  if (view.level !== DEFAULT_FLEET_VIEW.level) params.set('level', view.level);
  if (view.share !== DEFAULT_FLEET_VIEW.share) params.set('share', view.share);
  if (view.area) params.set('area', view.area);
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
