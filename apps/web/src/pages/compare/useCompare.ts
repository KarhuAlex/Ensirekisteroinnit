import type { EntitySummary } from '@regs/core';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCatalog } from '../../data/DataProvider';
import {
  compareCandidates,
  parseCompare,
  toCompareParams,
  type CompareState,
} from '../../lib/compareState';
import { seriesSlots } from '../../lib/comparison';
import { levelOf, type EntityLevel } from '../../lib/entityLevel';
import type { Timeline } from '../../lib/hooks';

export interface Compare {
  state: CompareState;
  /** How many of the items in the address were left out. */
  dropped: number;
  update: (patch: Partial<CompareState>) => void;
  /** The range comes from the address; the pointer is only local. */
  timeline: Timeline;
  chosen: EntitySummary[];
  level: EntityLevel | null;
  /** What can still be added: things on the level of the first one chosen. */
  candidates: EntitySummary[];
  slots: ReadonlyMap<string, number>;
}

/** Everything the compare page knows, read from the address and the catalog. */
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
  return {
    state,
    dropped,
    update,
    timeline: {
      range: state.range,
      setRange: (range) => update({ range }),
      hover,
      setHover,
      rest: null,
    },
    chosen,
    level,
    candidates: useMemo(
      () => compareCandidates(entities, state.items, level),
      [entities, state.items, level],
    ),
    slots: useMemo(() => seriesSlots(state.items), [state.items]),
  };
}
