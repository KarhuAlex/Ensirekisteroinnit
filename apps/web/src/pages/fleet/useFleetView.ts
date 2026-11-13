import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ElectricShare } from '../../lib/fleet';
import type { FuelFilter } from '../../lib/fleetMakes';
import {
  parseFleetView,
  toFleetParams,
  withArea,
  withFuel,
  withLevel,
  withMake,
  withShare,
  type FleetView,
} from '../../lib/fleetView';
import type { AreaLevel } from '../../lib/reviewState';

export interface FleetViewControls {
  view: FleetView;
  setLevel: (level: AreaLevel) => void;
  setShare: (share: ElectricShare) => void;
  setMake: (make: string | null) => void;
  setFuel: (fuel: FuelFilter) => void;
  /** Chooses an area, or clears the choice if it is already the chosen one. */
  chooseArea: (id: string) => void;
}

/**
 * The fleet page's view, read from the address and written back to it. The functions keep their
 * identity until the view changes, so what is memoized on them is not rebuilt every render.
 */
export function useFleetView(): FleetViewControls {
  const [params, setParams] = useSearchParams();
  const view = useMemo(() => parseFleetView(params), [params]);
  const show = useCallback(
    (next: FleetView) => setParams(toFleetParams(next), { replace: true }),
    [setParams],
  );
  return useMemo(
    () => ({
      view,
      setLevel: (level) => show(withLevel(view, level)),
      setShare: (share) => show(withShare(view, share)),
      setMake: (make) => show(withMake(view, make)),
      setFuel: (fuel) => show(withFuel(view, fuel)),
      chooseArea: (id) => show(withArea(view, id)),
    }),
    [view, show],
  );
}
