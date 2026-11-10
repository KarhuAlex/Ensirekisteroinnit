import type { EntityKind, EntitySummary } from '@regs/core';
import { isComparable, levelOf, type EntityLevel } from './entityLevel';
import { COMPARE_METRICS, DEFAULT_METRIC, MAX_COMPARED, type CompareMetric } from './comparison';
import type { Lang } from './format';
import { RANGE_IDS, type RangeId } from './stats';

/** The compare page follows from this state, which lives entirely in the URL. */
export interface CompareState {
  items: string[];
  metric: CompareMetric;
  range: RangeId;
  /** Allows items of different levels in one comparison. Off by default. */
  allowMixedLevels: boolean;
}

export interface ParsedCompare {
  state: CompareState;
  /** How many items in the address were left out: unknown, repeated, over the limit, or on another level. */
  dropped: number;
}

const DEFAULT_RANGE: RangeId = 'all';
const LEVELS_PARAM = 'levels';
const MIXED_LEVELS = 'any';

const oneOf = <T extends string>(options: readonly T[], value: string | null, fallback: T): T =>
  options.find((option) => option === value) ?? fallback;

/**
 * Reads the state from the address. Without `levels=any`, only items on the level of the first
 * valid item are kept.
 */
export function parseCompare(
  params: URLSearchParams,
  kindOf: (id: string) => EntityKind | undefined,
): ParsedCompare {
  const wanted = (params.get('items') ?? '').split(',').filter(Boolean);
  const allowMixedLevels = params.get(LEVELS_PARAM) === MIXED_LEVELS;
  let level: EntityLevel | null = null;
  const items: string[] = [];
  for (const id of wanted) {
    const kind = kindOf(id);
    const itemLevel = kind && isComparable(kind) ? levelOf(kind) : null;
    if (!itemLevel || items.includes(id) || items.length >= MAX_COMPARED) continue;
    level ??= itemLevel;
    if (allowMixedLevels || itemLevel === level) items.push(id);
  }
  return {
    state: {
      items,
      metric: oneOf(COMPARE_METRICS, params.get('metric'), DEFAULT_METRIC),
      range: oneOf(RANGE_IDS, params.get('range'), DEFAULT_RANGE),
      allowMixedLevels,
    },
    dropped: wanted.length - items.length,
  };
}

/** Leaves out defaults, so a plain comparison has a short address. */
export function toCompareParams(state: CompareState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.items.length > 0) params.set('items', state.items.join(','));
  if (state.metric !== DEFAULT_METRIC) params.set('metric', state.metric);
  if (state.range !== DEFAULT_RANGE) params.set('range', state.range);
  if (state.allowMixedLevels) params.set(LEVELS_PARAM, MIXED_LEVELS);
  return params;
}

/** Path to the compare page with these items preselected. */
export function comparePath(lang: Lang, items: readonly string[] = []): string {
  const query = toCompareParams({
    items: [...items],
    metric: DEFAULT_METRIC,
    range: DEFAULT_RANGE,
    allowMixedLevels: false,
  }).toString();
  return `/${lang}/compare${query ? `?${query}` : ''}`;
}

/** Items that can still be added: not already chosen, and on the same level unless mixed levels are allowed. */
export function compareCandidates(
  entities: readonly EntitySummary[],
  chosen: readonly string[],
  level: EntityLevel | null,
  allowMixedLevels: boolean,
): EntitySummary[] {
  return entities.filter((entity) => {
    const entityLevel = levelOf(entity.kind);
    return (
      entityLevel !== null &&
      !chosen.includes(entity.id) &&
      (allowMixedLevels || level === null || entityLevel === level)
    );
  });
}

/** Keeps the items on the first item's level, in order. */
function onFirstLevel(
  items: readonly string[],
  kindOf: (id: string) => EntityKind | undefined,
): string[] {
  const first = items[0] ? kindOf(items[0]) : undefined;
  const level = first ? levelOf(first) : null;
  return items.filter((id) => {
    const kind = kindOf(id);
    return kind !== undefined && levelOf(kind) === level;
  });
}

/**
 * Returns the state with mixed levels allowed or not. Turning them off keeps only items on the
 * first item's level, so the result is always a state the address can express.
 */
export function withMixedLevels(
  state: CompareState,
  allow: boolean,
  kindOf: (id: string) => EntityKind | undefined,
): CompareState {
  return {
    ...state,
    allowMixedLevels: allow,
    items: allow ? state.items : onFirstLevel(state.items, kindOf),
  };
}
