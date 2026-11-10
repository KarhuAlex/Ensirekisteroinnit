import type { EntitySummary } from '@regs/core';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCatalog } from '../../data/DataProvider';
import {
  compareCandidates,
  parseCompare,
  toCompareParams,
  withMixedLevels,
  type CompareState,
} from '../../lib/compareState';
import { seriesSlots } from '../../lib/comparison';
import { levelOf, type EntityLevel } from '../../lib/entityLevel';
import type { Timeline } from '../../lib/hooks';

export interface Compare {
  state: CompareState;
  /** Number of items in the address that were left out. */
  dropped: number;
  update: (patch: Partial<CompareState>) => void;
  /** Allows or forbids mixed levels. Forbidding keeps only items on the first item's level. */
  setAllowMixedLevels: (allow: boolean) => void;
  /** The range is read from the address; hover is local state. */
  timeline: Timeline;
  chosen: EntitySummary[];
  level: EntityLevel | null;
  /** True if the chosen items span more than one level. */
  mixedLevels: boolean;
  hasCorporateGroup: boolean;
  /** Items that can still be added; the first item's level only, unless mixed levels are allowed. */
  candidates: EntitySummary[];
  slots: ReadonlyMap<string, number>;
}

/** State for the compare page, derived from the address and the catalog. */
export function useCompare(): Compare {
  const { byId, entities } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [hover, setHover] = useState<number | null>(null);

  const { state, dropped } = useMemo(
    () => parseCompare(params, (id) => byId.get(id)?.kind),
    [params, byId],
  );
  const update = (patch: Partial<CompareState>) =>
    setParams(toCompareParams({ ...state, ...patch }), { replace: true });

  const chosen = useMemo(
    () => state.items.flatMap((id) => byId.get(id) ?? []),
    [state.items, byId],
  );
  const level = chosen[0] ? levelOf(chosen[0].kind) : null;
  const mixedLevels = new Set(chosen.map((e) => levelOf(e.kind))).size > 1;
  const hasCorporateGroup = chosen.some((e) => e.kind === 'corporategroup');
  const candidates = useMemo(
    () => compareCandidates(entities, state.items, level, state.allowMixedLevels),
    [entities, state.items, level, state.allowMixedLevels],
  );
  const slots = useMemo(() => seriesSlots(state.items), [state.items]);
  const setAllowMixedLevels = (allow: boolean) =>
    update(withMixedLevels(state, allow, (id) => byId.get(id)?.kind));

  return {
    state,
    dropped,
    update,
    setAllowMixedLevels,
    timeline: {
      range: state.range,
      setRange: (range) => update({ range }),
      hover,
      setHover,
      rest: null,
    },
    chosen,
    level,
    mixedLevels,
    hasCorporateGroup,
    candidates,
    slots,
  };
}
