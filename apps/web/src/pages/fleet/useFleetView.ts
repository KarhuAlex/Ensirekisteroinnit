import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ElectricShare } from '../../lib/fleet';
import {
  parseFleetView,
  toFleetParams,
  withArea,
  withLevel,
  withShare,
  type FleetView,
} from '../../lib/fleetView';
import type { AreaLevel } from '../../lib/reviewState';

export interface FleetViewControls {
  view: FleetView;
  setLevel: (level: AreaLevel) => void;
  setShare: (share: ElectricShare) => void;
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
  const setLevel = useCallback((level: AreaLevel) => show(withLevel(view, level)), [show, view]);
  const setShare = useCallback(
    (share: ElectricShare) => show(withShare(view, share)),
    [show, view],
  );
  const chooseArea = useCallback((id: string) => show(withArea(view, id)), [show, view]);
  return { view, setLevel, setShare, chooseArea };
}
